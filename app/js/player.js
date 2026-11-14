/* Afspiller: AVPlay på Samsung TV, <video> (+ hls.js) i browser. Rapporterer position til Jellyfin. */
var Player = (function () {
    var TICKS_PER_MS = 10000;
    var PROGRESS_INTERVAL = 10000;

    // ---------- Backends ----------
    function AvPlayBackend() {
        var av = webapis.avplay;
        this.open = function (url, startMs, ev) {
            try { av.stop(); av.close(); } catch (e) { /* ingen aktiv */ }
            av.open(url);
            av.setDisplayRect(0, 0, 1920, 1080);
            try {
                if (webapis.productinfo && webapis.productinfo.isUdPanelSupported()) av.setStreamingProperty('SET_MODE_4K', 'TRUE');
            } catch (e) { /* ikke understøttet */ }
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
            on('error', function () { ev.error(video.error); });
            on('loadedmetadata', function () {
                if (startMs > 0) video.currentTime = startMs / 1000;
                video.play().catch(function (e) { ev.error(e); });
            });
            ev.buffering(true);
            var isHls = url.indexOf('.m3u8') >= 0;
            if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
                loadHlsJs(function () {
                    if (!window.Hls || !window.Hls.isSupported()) return ev.error('HLS understøttes ikke');
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

    // ---------- Tilstand ----------
    var active = false;
    var backend = null;
    var session = null;   // { item, info, posMs, durMs }
    var progressTimer = null, hideTimer = null, seekTimer = null;
    var seekTarget = null;
    var onExit = null;

    var el = {};
    function $(id) { return document.getElementById(id); }

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
        updateUi();
        clearTimeout(hideTimer);
        if (!stay && !(backend && backend.paused())) {
            hideTimer = setTimeout(function () { el.ui.classList.add('hidden'); }, 4000);
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
            EventName: eventName
        };
    }

    function progress(eventName) {
        if (session && session.started) Api.report('progress', reportData(eventName || 'TimeUpdate'));
    }

    // ---------- Start / stop ----------
    async function start(item, startTicks, exitCallback) {
        if (active) await stop();
        active = true;
        onExit = exitCallback;
        document.body.classList.add('playing');
        el.title.textContent = item.SeriesName || item.Name;
        el.sub.textContent = item.SeriesName
            ? 'S' + (item.ParentIndexNumber || 0) + ':E' + (item.IndexNumber || 0) + ' · ' + item.Name
            : (item.ProductionYear || '');
        el.spinner.classList.remove('hidden');
        showUi(true);

        var info;
        try {
            info = await Api.playbackInfo(item.Id);
        } catch (e) {
            fail('Kunne ikke starte afspilning: ' + (e.message || e));
            return;
        }
        if (!active) return;
        var startMs = (startTicks || 0) / TICKS_PER_MS;
        session = { item: item, info: info, posMs: startMs, started: false };
        backend = Api.isTizen && window.webapis && webapis.avplay ? new AvPlayBackend() : new HtmlBackend();

        try {
            backend.open(info.url, startMs, {
                buffering: function (b) { el.spinner.classList.toggle('hidden', !b); },
                time: function (ms) { if (session && ms > 0) { session.posMs = ms; if (!el.ui.classList.contains('hidden')) updateUi(); } },
                started: function () {
                    if (!session || session.started) return;
                    session.started = true;
                    Api.report('start', reportData());
                    progressTimer = setInterval(function () { progress(); }, PROGRESS_INTERVAL);
                    showUi();
                },
                ended: function () { if (session) session.posMs = durMs(); stop(); },
                error: function (err) { fail('Afspilningsfejl: ' + (err && err.message ? err.message : err)); }
            });
        } catch (e) {
            fail('Afspilningsfejl: ' + (e.message || e));
        }
    }

    function fail(msg) {
        App.toast(msg);
        stop();
    }

    async function stop() {
        if (!active) return;
        active = false;
        clearInterval(progressTimer);
        clearTimeout(hideTimer);
        clearTimeout(seekTimer);
        seekTarget = null;
        var s = session;
        if (backend && s && s.started) {
            var t = backend.time();
            if (t > 0) s.posMs = t;
        }
        if (backend) backend.stop();
        backend = null;
        session = null;
        el.ui.classList.add('hidden');
        el.spinner.classList.add('hidden');
        document.body.classList.remove('playing');
        if (s && s.started) {
            var data = {
                ItemId: s.item.Id, MediaSourceId: s.info.mediaSourceId, PlaySessionId: s.info.playSessionId,
                PositionTicks: Math.round(s.posMs * TICKS_PER_MS)
            };
            await Api.report('stop', data);
            if (s.info.method !== 'DirectPlay') Api.stopEncoding(s.info.playSessionId);
        }
        var cb = onExit;
        onExit = null;
        if (cb) cb();
    }

    // ---------- Styring ----------
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
        switch (k) {
            case 13: case 10252: togglePause(); return true;           // OK, Play/Pause
            case 415: togglePause('play'); return true;                // Play
            case 19: togglePause('pause'); return true;                // Pause
            case 37: seekBy(-10000); return true;
            case 39: seekBy(10000); return true;
            case 412: seekBy(-30000); return true;                      // Spol tilbage
            case 417: seekBy(30000); return true;                       // Spol frem
            case 38: case 40: showUi(); return true;
            case 10009: case 27: case 8: case 413: stop(); return true; // Tilbage / Stop
        }
        return false;
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && active && backend && !backend.paused()) togglePause('pause');
    });
    window.addEventListener('beforeunload', function () { if (active) stop(); });

    document.addEventListener('DOMContentLoaded', function () {
        el = {
            ui: $('player-ui'), title: $('pu-title'), sub: $('pu-sub'), fill: $('pu-fill'), seek: $('pu-seek'),
            time: $('pu-time'), dur: $('pu-dur'), state: $('pu-state'), spinner: $('pu-spinner')
        };
    });

    return {
        start: start, stop: stop, onKey: onKey, fmt: fmt,
        get active() { return active; }
    };
})();
