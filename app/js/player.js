/* Player: AVPlay on Samsung TVs, <video> (+ hls.js) in a browser.
   Reports position to Jellyfin, picks audio/subtitles and renders text subtitles itself. */
var Player = (function () {
    var TICKS_PER_MS = 10000;
    var PROGRESS_INTERVAL = 10000;

    // ---------- Backends ----------
    function AvPlayBackend() {
        var av = webapis.avplay;
        this.open = function (url, startMs, ev) {
            try { av.stop(); av.close(); } catch (e) { /* nothing active */ }
            av.open(url);
            av.setDisplayRect(0, 0, 1920, 1080);
            // AVPlay stretches to full screen by default; keep the video's own aspect ratio
            // (4:3 gets black bars instead of being stretched to 16:9).
            try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e) { /* not supported */ }
            try {
                if (webapis.productinfo && webapis.productinfo.isUdPanelSupported()) av.setStreamingProperty('SET_MODE_4K', 'TRUE');
            } catch (e) { /* not supported */ }
            av.setListener({
                onbufferingstart: function () { ev.buffering(true); },
                onbufferingprogress: function () {},
                onbufferingcomplete: function () { ev.buffering(false); },
                oncurrentplaytime: function (ms) { ev.time(ms); },
                onstreamcompleted: function () { ev.ended(); },
                onerror: function (err) { ev.error(err); },
                onevent: function () {}, onsubtitlechange: function () {}, ondrmevent: function () {}
            });
            ev.buffering(true);
            av.prepareAsync(function () {
                ev.buffering(false);
                var go = function () { av.play(); ev.started(); };
                if (startMs > 0) av.seekTo(startMs, go, go); else go();
            }, function (err) { ev.error(err); });
        };
        this.play = function () { av.play(); };
        this.pause = function () { av.pause(); };
        this.paused = function () { return av.getState() === 'PAUSED'; };
        this.seek = function (ms, done) { av.seekTo(Math.max(0, ms), done || function () {}, done || function () {}); };
        this.time = function () { try { return av.getCurrentTime(); } catch (e) { return 0; } };
        this.duration = function () { try { return av.getDuration(); } catch (e) { return 0; } };
        // Select the n-th audio track in the file (direct play). Returns true on success.
        this.selectAudio = function (n) {
            try {
                var tracks = av.getTotalTrackInfo().filter(function (tr) { return tr.type === 'AUDIO'; });
                if (!tracks[n]) return false;
                av.setSelectTrack('AUDIO', tracks[n].index);
                return true;
            } catch (e) { return false; }
        };
        this.stop = function () { try { av.stop(); } catch (e) {} try { av.close(); } catch (e) {} };
    }

    function HtmlBackend() {
        var video = document.getElementById('video');
        var hls = null;
        var listeners = [];
        function on(name, fn) { video.addEventListener(name, fn); listeners.push([name, fn]); }

        function loadHlsJs(cb) {
            if (window.Hls) return cb();
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
            s.onload = cb;
            s.onerror = cb;
            document.head.appendChild(s);
        }

        this.open = function (url, startMs, ev) {
            var started = false;
            video.style.display = 'block';
            on('waiting', function () { ev.buffering(true); });
            on('playing', function () { ev.buffering(false); if (!started) { started = true; ev.started(); } });
            on('timeupdate', function () { ev.time(video.currentTime * 1000); });
            on('ended', function () { ev.ended(); });
            on('error', function () { ev.error(video.error && video.error.message ? video.error.message : 'media error'); });
            on('loadedmetadata', function () {
                if (startMs > 0) video.currentTime = startMs / 1000;
                video.play().catch(function (e) { ev.error(e); });
            });
            ev.buffering(true);
            var isHls = url.indexOf('.m3u8') >= 0;
            if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
                loadHlsJs(function () {
                    if (!window.Hls || !window.Hls.isSupported()) return ev.error('HLS');
                    hls = new window.Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                });
            } else {
                video.src = url;
            }
        };
        this.play = function () { video.play(); };
        this.pause = function () { video.pause(); };
        this.paused = function () { return video.paused; };
        this.seek = function (ms, done) { video.currentTime = Math.max(0, ms / 1000); if (done) done(); };
        this.time = function () { return video.currentTime * 1000; };
        this.duration = function () { return (video.duration || 0) * 1000; };
        this.selectAudio = function () { return false; };
        this.stop = function () {
            listeners.forEach(function (l) { video.removeEventListener(l[0], l[1]); });
            listeners = [];
            if (hls) { hls.destroy(); hls = null; }
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.style.display = 'none';
        };
    }

    // ---------- Subtitles (WebVTT) ----------
    var Subs = (function () {
        var cues = [], timer = null, box = null, lastHtml = '';
        function parseTime(s) {
            var p = s.trim().split(':');
            var sec = parseFloat(p.pop().replace(',', '.'));
            var min = parseInt(p.pop() || '0', 10), h = parseInt(p.pop() || '0', 10);
            return ((h * 60 + min) * 60 + sec) * 1000;
        }
        function clean(text) {
            // Escape everything but keep <i> and <b>; strip ASS tags like {\an8}
            return text.replace(/\{\\[^}]*\}/g, '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/&lt;(\/?)(i|b)&gt;/g, '<$1$2>')
                .replace(/&lt;[^&]*&gt;/g, '');
        }
        function parse(vtt) {
            var out = [];
            vtt.replace(/\r/g, '').split(/\n\n+/).forEach(function (block) {
                var lines = block.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].indexOf('-->') > 0) {
                        var parts = lines[i].split('-->');
                        var text = lines.slice(i + 1).join('\n').trim();
                        if (text) out.push({ start: parseTime(parts[0]), end: parseTime(parts[1].trim().split(' ')[0]), html: clean(text).replace(/\n/g, '<br>') });
                        break;
                    }
                }
            });
            return out;
        }
        function render(ms) {
            var html = '';
            for (var i = 0; i < cues.length; i++) {
                if (cues[i].start <= ms && cues[i].end >= ms) html += (html ? '<br>' : '') + cues[i].html;
            }
            if (html !== lastHtml) {
                lastHtml = html;
                box.innerHTML = html ? '<span>' + html + '</span>' : '';
            }
        }
        return {
            load: function (url, getTime) {
                this.clear();
                box = document.getElementById('subs');
                var token = {};
                this.token = token;
                var self = this;
                fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).then(function (txt) {
                    if (self.token !== token) return;
                    cues = parse(txt);
                    timer = setInterval(function () { render(getTime()); }, 200);
                }).catch(function () { /* no subtitles */ });
            },
            clear: function () {
                this.token = null;
                clearInterval(timer);
                timer = null;
                cues = [];
                lastHtml = '';
                var b = document.getElementById('subs');
                if (b) b.innerHTML = '';
            }
        };
    })();

    // ---------- State ----------
    var active = false;
    var backend = null;
    var session = null;   // { item, info, posMs, started, audioIndex, subIndex, burnIn }
    var progressTimer = null, hideTimer = null, seekTimer = null;
    var seekTarget = null;
    var onExit = null;
    var menuOpen = false;

    var el = {};
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function fmt(ms) {
        var s = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function durMs() {
        var d = backend ? backend.duration() : 0;
        if (d > 0 && isFinite(d)) return d;
        return session && session.info.runTimeTicks ? session.info.runTimeTicks / TICKS_PER_MS : 0;
    }

    function currentMs() {
        if (backend && session && session.started) {
            var tm = backend.time();
            if (tm > 0) return tm;
        }
        return session ? session.posMs : 0;
    }

    function updateUi() {
        if (!session) return;
        var d = durMs();
        var pos = session.posMs;
        el.time.textContent = fmt(seekTarget !== null ? seekTarget : pos);
        el.dur.textContent = fmt(d);
        el.fill.style.width = d ? Math.min(100, pos / d * 100) + '%' : '0%';
        if (seekTarget !== null && d) {
            el.seek.style.display = 'block';
            el.seek.style.left = Math.min(100, seekTarget / d * 100) + '%';
        } else {
            el.seek.style.display = 'none';
        }
        el.state.textContent = backend && backend.paused() ? '❚❚' : '▶';
    }

    function showUi(stay) {
        el.ui.classList.remove('hidden');
        document.body.classList.add('ui-visible');
        updateUi();
        clearTimeout(hideTimer);
        if (!stay && !menuOpen && !(backend && backend.paused())) {
            hideTimer = setTimeout(function () {
                el.ui.classList.add('hidden');
                document.body.classList.remove('ui-visible');
            }, 4000);
        }
    }

    function reportData(eventName) {
        return {
            ItemId: session.item.Id,
            MediaSourceId: session.info.mediaSourceId,
            PlaySessionId: session.info.playSessionId,
            PositionTicks: Math.round(session.posMs * TICKS_PER_MS),
            IsPaused: backend ? backend.paused() : false,
            CanSeek: true,
            PlayMethod: session.info.method,
            AudioStreamIndex: session.audioIndex,
            SubtitleStreamIndex: session.subIndex,
            EventName: eventName
        };
    }

    function progress(eventName) {
        if (session && session.started) Api.report('progress', reportData(eventName || 'TimeUpdate'));
    }

    // ---------- Track selection ----------
    function streamsOf(type, streams) {
        return (streams || []).filter(function (s) { return s.Type === type; });
    }

    // Pick audio/subtitle tracks from saved language choices, else the server default (the user's Jellyfin settings).
    function pickTracks(streams, defAudio, defSub) {
        var prefs = Api.state.prefs || {};
        var audios = streamsOf('Audio', streams), subs = streamsOf('Subtitle', streams);
        var audio = defAudio, sub = defSub;
        if (prefs.audioLang) {
            var a = audios.filter(function (s) { return s.Language === prefs.audioLang; })[0];
            if (a) audio = a.Index;
        }
        if ((audio === undefined || audio === null) && audios.length) {
            audio = (audios.filter(function (s) { return s.IsDefault; })[0] || audios[0]).Index;
        }
        if (prefs.subLang === 'off') sub = -1;
        else if (prefs.subLang) {
            var m = subs.filter(function (s) { return s.Language === prefs.subLang && !s.IsForced; })[0] ||
                subs.filter(function (s) { return s.Language === prefs.subLang; })[0];
            if (m) sub = m.Index;
        }
        if (sub === undefined || sub === null) sub = -1;
        return { audio: audio, sub: sub };
    }

    function findStream(index) {
        if (!session) return null;
        return session.info.streams.filter(function (s) { return s.Index === index; })[0] || null;
    }

    function isTextSub(s) {
        if (!s) return false;
        if (s.IsTextSubtitleStream !== undefined) return s.IsTextSubtitleStream;
        return /srt|subrip|vtt|ass|ssa|mov_text|ttml/i.test(s.Codec || '');
    }

    // Position in the file among non-external audio tracks (for AVPlay's track selection).
    function audioPosition(index) {
        var list = streamsOf('Audio', session.info.streams).filter(function (s) { return !s.IsExternal; });
        for (var i = 0; i < list.length; i++) if (list[i].Index === index) return i;
        return -1;
    }

    function applySubtitles() {
        Subs.clear();
        var s = findStream(session.subIndex);
        if (s && isTextSub(s) && !session.burnIn) {
            var url = s.DeliveryUrl ? Api.state.server + s.DeliveryUrl : Api.subtitleUrl(session.item.Id, session.info.mediaSourceId, s.Index);
            if (url.indexOf('api_key=') < 0 && url.indexOf('ApiKey=') < 0) url += (url.indexOf('?') < 0 ? '?' : '&') + 'api_key=' + Api.state.token;
            Subs.load(url, currentMs);
        }
    }

    // ---------- Start / stop ----------
    // opts: { audioIndex, subIndex } – omit to use saved language choices
    async function start(item, startTicks, exitCallback, opts) {
        if (active) await teardown(false);
        opts = opts || {};
        active = true;
        onExit = exitCallback;
        document.body.classList.add('playing');
        el.title.textContent = item.SeriesName || item.Name;
        el.sub.textContent = item.SeriesName
            ? 'S' + (item.ParentIndexNumber || 0) + ':E' + (item.IndexNumber || 0) + ' · ' + item.Name
            : (item.ProductionYear || '');
        el.hint.textContent = t('player_hint');
        el.spinner.classList.remove('hidden');
        showUi(true);

        var info, tracks;
        try {
            // Pick tracks from the item's source (if known) so the server can transcode correctly from the start.
            var src0 = item.MediaSources && item.MediaSources[0];
            tracks = src0 ? pickTracks(src0.MediaStreams, src0.DefaultAudioStreamIndex, src0.DefaultSubtitleStreamIndex) : {};
            if (opts.audioIndex !== undefined) tracks.audio = opts.audioIndex;
            if (opts.subIndex !== undefined) tracks.sub = opts.subIndex;

            // Browsers can't switch audio tracks in direct play -> let the server transcode if it isn't the first track.
            var noDirect = false;
            if (!Api.isTizen && src0 && tracks.audio !== undefined) {
                var firstAudio = streamsOf('Audio', src0.MediaStreams)[0];
                noDirect = !!firstAudio && firstAudio.Index !== tracks.audio;
            }
            info = await Api.playbackInfo(item.Id, {
                audioIndex: tracks.audio, subIndex: tracks.sub,
                mediaSourceId: src0 ? src0.Id : null, noDirectPlay: noDirect || opts.noDirectPlay
            });
            if (!src0) {
                var picked = pickTracks(info.streams, info.defaultAudio, info.defaultSub);
                if (tracks.audio === undefined) tracks.audio = picked.audio;
                if (tracks.sub === undefined) tracks.sub = picked.sub;
            }
        } catch (e) {
            fail(t('start_error', { e: e.message || e }));
            return;
        }
        if (!active) return;
        var startMs = (startTicks || 0) / TICKS_PER_MS;
        session = {
            item: item, info: info, posMs: startMs, started: false,
            audioIndex: tracks.audio, subIndex: tracks.sub,
            burnIn: info.method !== 'DirectPlay' && /SubtitleMethod=Encode/i.test(info.url)
        };
        backend = Api.isTizen && window.webapis && webapis.avplay ? new AvPlayBackend() : new HtmlBackend();

        try {
            backend.open(info.url, startMs, {
                buffering: function (b) { el.spinner.classList.toggle('hidden', !b); },
                time: function (ms) { if (session && ms > 0) { session.posMs = ms; if (!el.ui.classList.contains('hidden')) updateUi(); } },
                started: function () {
                    if (!session || session.started) return;
                    session.started = true;
                    // Direct play on the TV: select the audio track in the player
                    if (info.method === 'DirectPlay' && session.audioIndex !== undefined) {
                        var n = audioPosition(session.audioIndex);
                        if (n > 0 || streamsOf('Audio', info.streams).length > 1) backend.selectAudio(Math.max(0, n));
                    }
                    applySubtitles();
                    Api.report('start', reportData());
                    progressTimer = setInterval(function () { progress(); }, PROGRESS_INTERVAL);
                    showUi();
                },
                ended: function () { if (session) session.posMs = durMs(); stop(true); },
                error: function (err) { fail(t('play_error', { e: err && err.message ? err.message : err })); }
            });
        } catch (e) {
            fail(t('play_error', { e: e.message || e }));
        }
    }

    function fail(msg) {
        App.toast(msg);
        stop();
    }

    // Stop playback and report. full=false is used for restarts (track change), where the screen should not change.
    async function teardown(full) {
        if (!active && !session) return null;
        active = false;
        clearInterval(progressTimer);
        clearTimeout(hideTimer);
        clearTimeout(seekTimer);
        seekTarget = null;
        closeMenu();
        Subs.clear();
        var s = session;
        if (backend && s && s.started) {
            var tm = backend.time();
            if (tm > 0 && !s.ended) s.posMs = tm;
        }
        if (backend) backend.stop();
        backend = null;
        session = null;
        if (full) {
            el.ui.classList.add('hidden');
            el.spinner.classList.add('hidden');
            document.body.classList.remove('playing');
            document.body.classList.remove('ui-visible');
        }
        if (s && s.started) {
            await Api.report('stop', {
                ItemId: s.item.Id, MediaSourceId: s.info.mediaSourceId, PlaySessionId: s.info.playSessionId,
                PositionTicks: Math.round(s.posMs * TICKS_PER_MS)
            });
            if (s.info.method !== 'DirectPlay') Api.stopEncoding(s.info.playSessionId);
        }
        return s;
    }

    async function stop(ended) {
        if (!active) return;
        if (ended && session) session.ended = true;
        var item = session ? session.item : null;
        await teardown(true);
        var cb = onExit;
        onExit = null;
        if (cb) cb(item, !!ended);
    }

    // Restart the same item at the current position with other tracks.
    async function restartWith(opts) {
        if (!session) return;
        var item = session.item, cb = onExit;
        var pos = currentMs();
        await teardown(false);
        start(item, pos * TICKS_PER_MS, cb, opts);
    }

    // ---------- Track menu ----------
    function trackLabel(s) {
        return s.DisplayTitle || [s.Language, s.Codec].filter(Boolean).join(' · ') || t('unknown');
    }

    function openMenu() {
        if (!session || !session.started) return;
        menuOpen = true;
        document.body.classList.add('menu-open');
        var audios = streamsOf('Audio', session.info.streams);
        var subs = streamsOf('Subtitle', session.info.streams);
        var html = '<div class="tm-col" data-scroll="y"><h3>' + esc(t('audio')) + '</h3>' +
            audios.map(function (s) {
                return '<div class="tm-item focusable' + (s.Index === session.audioIndex ? ' on' : '') + '" data-type="audio" data-index="' + s.Index + '">' + esc(trackLabel(s)) + '</div>';
            }).join('') + '</div>' +
            '<div class="tm-col" data-scroll="y"><h3>' + esc(t('subtitles')) + '</h3>' +
            '<div class="tm-item focusable' + (session.subIndex === -1 ? ' on' : '') + '" data-type="sub" data-index="-1">' + esc(t('off')) + '</div>' +
            subs.map(function (s) {
                return '<div class="tm-item focusable' + (s.Index === session.subIndex ? ' on' : '') + '" data-type="sub" data-index="' + s.Index + '">' + esc(trackLabel(s)) + '</div>';
            }).join('') + '</div>';
        el.menu.innerHTML = html;
        el.menu.classList.remove('hidden');
        Nav.setScope(el.menu);
        Nav.focus(el.menu.querySelector('.tm-item.on') || el.menu.querySelector('.tm-item'));
        showUi(true);
    }

    function closeMenu() {
        if (!menuOpen) return;
        menuOpen = false;
        document.body.classList.remove('menu-open');
        el.menu.classList.add('hidden');
        el.menu.innerHTML = '';
        Nav.setScope(document.getElementById('app'));
        showUi();
    }

    function chooseTrack(node) {
        var type = node.getAttribute('data-type');
        var index = parseInt(node.getAttribute('data-index'), 10);
        closeMenu();
        if (!session) return;
        if (type === 'audio') {
            if (index === session.audioIndex) return;
            var s = findStream(index);
            Api.savePrefs({ audioLang: s && s.Language ? s.Language : null });
            if (session.info.method === 'DirectPlay' && backend.selectAudio(audioPosition(index))) {
                session.audioIndex = index;
                progress('AudioTrackChange');
            } else {
                restartWith({ audioIndex: index, subIndex: session.subIndex });
            }
        } else {
            if (index === session.subIndex) return;
            var sub = findStream(index);
            Api.savePrefs({ subLang: index === -1 ? 'off' : (sub && sub.Language ? sub.Language : null) });
            // Text subtitles (or off) can be switched without a restart, unless the current ones are burned in.
            if (!session.burnIn && (index === -1 || isTextSub(sub))) {
                session.subIndex = index;
                applySubtitles();
                progress('SubtitleTrackChange');
            } else {
                restartWith({ audioIndex: session.audioIndex, subIndex: index });
            }
        }
    }

    // ---------- Controls ----------
    function togglePause(forceState) {
        if (!backend || !session || !session.started) return;
        var paused = backend.paused();
        if (forceState === 'play' || (forceState === undefined && paused)) {
            if (paused) { backend.play(); progress('Unpause'); }
        } else if (!paused) {
            backend.pause(); progress('Pause');
        }
        setTimeout(function () { showUi(); }, 50);
    }

    function seekBy(deltaMs) {
        if (!backend || !session || !session.started) return;
        var d = durMs();
        var base = seekTarget !== null ? seekTarget : session.posMs;
        seekTarget = Math.max(0, d ? Math.min(d - 2000, base + deltaMs) : base + deltaMs);
        showUi();
        clearTimeout(seekTimer);
        seekTimer = setTimeout(function () {
            var target = seekTarget;
            seekTarget = null;
            if (!backend || !session) return;
            session.posMs = target;
            backend.seek(target, function () { progress('TimeUpdate'); });
            showUi();
        }, 700);
    }

    function onKey(k) {
        if (menuOpen) {
            switch (k) {
                case 37: Nav.move('left'); return true;
                case 39: Nav.move('right'); return true;
                case 38: Nav.move('up'); return true;
                case 40: Nav.move('down'); return true;
                case 13: if (Nav.current) chooseTrack(Nav.current); return true;
                case 10009: case 27: case 8: closeMenu(); return true;
            }
            return true;
        }
        switch (k) {
            case 13: case 10252: togglePause(); return true;           // OK, Play/Pause
            case 415: togglePause('play'); return true;                // Play
            case 19: togglePause('pause'); return true;                // Pause
            case 37: seekBy(-10000); return true;
            case 39: seekBy(10000); return true;
            case 412: seekBy(-30000); return true;                      // Rewind
            case 417: seekBy(30000); return true;                       // Fast forward
            case 38: openMenu(); return true;                           // Up: audio/subtitles
            case 40: showUi(); return true;
            case 10009: case 27: case 8: case 413: stop(); return true; // Back / Stop
        }
        return false;
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && active && backend && !backend.paused()) togglePause('pause');
    });
    window.addEventListener('beforeunload', function () { if (active) stop(); });

    // Clicks in the track menu (browser testing)
    document.addEventListener('click', function (e) {
        if (!menuOpen) return;
        var node = e.target.closest ? e.target.closest('.tm-item') : null;
        if (node) chooseTrack(node);
    });

    el = {
        ui: $('player-ui'), title: $('pu-title'), sub: $('pu-sub'), fill: $('pu-fill'), seek: $('pu-seek'),
        time: $('pu-time'), dur: $('pu-dur'), state: $('pu-state'), spinner: $('pu-spinner'), hint: $('pu-hint'),
        menu: $('track-menu')
    };

    return {
        start: start, stop: stop, onKey: onKey, fmt: fmt,
        get active() { return active; }
    };
})();
