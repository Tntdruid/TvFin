/* Funscript Session (the PC app) on the TV: pairing, saved sessions, and a player that plays a
   session's clips one after another while a Handy follows the session script (Handy API v3, HSSP).
   Written without ?. and ?? so it runs on older Tizen TVs. */

// ------------------------------------------------------------------ connection to the PC app
var Fun = (function () {
    var STORE = 'tvfin-funscript';   // per TvFin user: { url, key, handy: { appId, key } }
    var DEFAULT_PORT = 8001;          // Funscript's phone-remote server, which also serves the TV

    function all() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } }
    function userKey() { return (Api.state.server || '') + '|' + (Api.state.userId || ''); }
    function config() { return all()[userKey()] || null; }
    function save(cfg) {
        var a = all();
        if (cfg) a[userKey()] = cfg; else delete a[userKey()];
        try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) { /* ignore */ }
    }

    function baseUrl(input) {
        var s = String(input || '').trim().replace(/\/+$/, '');
        if (!s) return '';
        if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
        if (!/:\d+$/.test(s.replace(/^https?:\/\//i, ''))) s += ':' + DEFAULT_PORT;
        return s;
    }

    function timeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var tm = setTimeout(function () { reject(new Error('Timeout')); }, ms);
            promise.then(function (v) { clearTimeout(tm); resolve(v); }, function (e) { clearTimeout(tm); reject(e); });
        });
    }

    async function getJson(url, opts) {
        var res = await timeout(fetch(url, opts || {}), 10000);
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) { var err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; throw err; }
        return data;
    }

    // Pairing: the TV gets a code, the user presses "Allow" in the app on the PC
    function pair(url) { return getJson(url + '/tv/pair?name=' + encodeURIComponent('TvFin · ' + (Api.isTizen ? 'Samsung TV' : 'Browser')), { method: 'POST' }); }
    function pairStatus(url, id) { return getJson(url + '/tv/pair/' + encodeURIComponent(id)); }

    // ---- Finding Funscript on the network ----
    // A TV web app can't broadcast (no UDP/mDNS), so we ask every address in the local /24 networks on port 8001.
    // Networks come from the TV's own IP (Samsung webapis), the Jellyfin server and a previously used Funscript address.
    function prefixes() {
        var out = [];
        function add(host) {
            var m = /^(\d+)\.(\d+)\.(\d+)\.\d+$/.exec(String(host || ''));
            if (!m) return;
            var p = m[1] + '.' + m[2] + '.' + m[3];
            if (out.indexOf(p) < 0) out.push(p);
        }
        function hostOf(url) { var m = /^https?:\/\/([^:/]+)/i.exec(String(url || '')); return m ? m[1] : ''; }
        try { if (window.webapis && webapis.network && webapis.network.getIp) add(webapis.network.getIp()); } catch (e) { /* not available */ }
        add(hostOf(Api.state.server));
        var cfg = config();
        if (cfg) add(hostOf(cfg.url));
        return out;
    }

    // Ask one address; resolves to { url, name, host } for a Funscript PC, or null
    function probe(host, port, ms) {
        var ctrl = window.AbortController ? new AbortController() : null;
        var url = 'http://' + host + ':' + port;
        return timeout(fetch(url + '/tv/hello', ctrl ? { signal: ctrl.signal } : {}), ms)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return d && d.app === 'Funscript Session' ? { url: url, name: d.name || host, host: host } : null; })
            .catch(function () { if (ctrl) { try { ctrl.abort(); } catch (e) { /* ignore */ } } return null; });
    }

    // Scan the local networks; onFound is called for each PC as it answers. Resolves with all of them.
    // isAlive() lets the caller stop the scan (e.g. when leaving the screen).
    async function discover(onFound, isAlive, extraPrefixes) {
        var nets = prefixes().concat(extraPrefixes || []);
        var hosts = [];
        nets.forEach(function (p) { for (var i = 1; i < 255; i++) hosts.push(p + '.' + i); });
        var found = [], next = 0, WORKERS = 40;
        async function worker() {
            while (next < hosts.length && (!isAlive || isAlive())) {
                var h = hosts[next++];
                var hit = await probe(h, DEFAULT_PORT, 1500);
                if (hit && (!isAlive || isAlive())) { found.push(hit); if (onFound) onFound(hit); }
            }
        }
        var workers = [];
        for (var w = 0; w < WORKERS; w++) workers.push(worker());
        await Promise.all(workers);
        return { found: found, networks: nets };
    }

    function q(cfg) { return '?k=' + encodeURIComponent(cfg.key); }
    function sessions(cfg) { return getJson(cfg.url + '/tv/sessions' + q(cfg)); }
    function session(cfg, id) { return getJson(cfg.url + '/tv/sessions/' + id + q(cfg)); }
    function mediaUrl(cfg, videoId) { return cfg.url + '/tv/media/' + videoId + q(cfg); }
    function thumbUrl(cfg, videoId) { return cfg.url + '/tv/thumb/' + videoId + q(cfg); }

    // Reports back to the PC app: played sessions, played time and where a session was left.
    // The position is the same one the PC keeps, so a session can be continued on either.
    function post(cfg, path, body) {
        return getJson(cfg.url + path + q(cfg), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
        }).catch(function (e) { console.warn('Funscript', path, e); });
    }
    function resume(cfg) {
        return getJson(cfg.url + '/tv/resume' + q(cfg)).then(function (r) { return r.resume || null; },
            function () { return null; });
    }
    function saveResume(cfg, sessionId, ms) { return post(cfg, '/tv/resume', sessionId ? { sessionId: sessionId, ms: Math.round(ms) } : {}); }
    function played(cfg, sessionId) { return post(cfg, '/tv/sessions/' + sessionId + '/played'); }
    function tick(cfg, seconds) { return post(cfg, '/tv/stats/tick', { seconds: seconds }); }

    return {
        config: config, save: save, baseUrl: baseUrl, pair: pair, pairStatus: pairStatus, discover: discover,
        sessions: sessions, session: session, mediaUrl: mediaUrl, thumbUrl: thumbUrl,
        resume: resume, saveResume: saveResume, played: played, tick: tick
    };
})();

// ------------------------------------------------------------------ The Handy (firmware 4, API v3, HSSP)
// Port of Funscript's web/handy.js: the session script is uploaded once and the device plays it
// in sync by itself; we only tell it where in the session we are (and when we pause).
var Handy = (function () {
    var API = 'https://www.handyfeeling.com/api/handy-rest/v3';
    var UPLOAD = 'https://www.handyfeeling.com/api/hosting/v2/upload';
    var MAX_CSV_BYTES = 524288;

    var appId = '', key = '', connected = false, clockOffset = 0, scriptId = null, setupPromise = null, anchor = null;

    async function call(method, path, body) {
        var res = await fetch(API + path, {
            method: method,
            headers: { 'X-Api-Key': appId, 'X-Connection-Key': key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || data.error) {
            var e = data.error || {};
            if (res.status === 401) throw new Error(t('handy_bad_app'));
            if (e.connected === false || e.name === 'DeviceNotConnected') throw new Error(t('handy_offline'));
            throw new Error(e.message || e.name || ('HTTP ' + res.status));
        }
        return data.result || {};
    }

    // Estimate the server clock from several round trips, ignoring the slowest ones
    async function syncClock(samples) {
        samples = samples || 12;
        var results = [];
        for (var i = 0; i < samples; i++) {
            var t0 = Date.now();
            var r = await fetch(API + '/servertime').then(function (x) { return x.json(); });
            var t1 = Date.now();
            results.push({ rtd: t1 - t0, offset: r.server_time + (t1 - t0) / 2 - t1 });
        }
        results.sort(function (a, b) { return a.rtd - b.rtd; });
        var best = results.slice(0, Math.ceil(samples / 2));
        clockOffset = best.reduce(function (s, r) { return s + r.offset; }, 0) / best.length;
    }

    async function connect(applicationId, connectionKey) {
        appId = String(applicationId || '').trim();
        key = String(connectionKey || '').trim();
        connected = false; scriptId = null; setupPromise = null;
        var st = await call('GET', '/connected');
        if (!st.connected) throw new Error(t('handy_offline'));
        await call('PUT', '/mode2', { mode: 1 });   // HSSP
        await syncClock();
        connected = true;
    }

    function prepare(session) {
        var sum = session.actions.reduce(function (acc, a, i) { return (acc + a.at * (a.pos + 1) * (i % 7 + 1)) % 1e12; }, 0);
        var id = session.id + ':' + session.actions.length + ':' + session.totalMs + ':' + sum;
        if (scriptId === id && setupPromise) return setupPromise;
        scriptId = id;
        setupPromise = (async function () {
            var csv = session.actions.map(function (a) { return Math.round(a.at) + ',' + Math.round(a.pos); }).join('\n') + '\n';
            if (csv.length > MAX_CSV_BYTES) throw new Error(t('handy_too_long'));
            var form = new FormData();
            form.append('file', new Blob([csv], { type: 'text/csv' }), 'session-' + session.id + '.csv');
            var res = await fetch(UPLOAD, { method: 'POST', body: form });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.url) throw new Error(t('handy_upload_failed'));
            await call('PUT', '/hssp/setup', { url: data.url });
        })();
        setupPromise.catch(function () { if (scriptId === id) { scriptId = null; setupPromise = null; } });
        return setupPromise;
    }

    function play(startMs) {
        if (!connected) return Promise.resolve();
        var startTime = Math.max(0, Math.round(startMs));
        anchor = { startTime: startTime, wall: Date.now() };
        return call('PUT', '/hssp/play', { start_time: startTime, server_time: Math.round(Date.now() + clockOffset), playback_rate: 1 })
            .catch(function (e) { console.warn('Handy play', e); });
    }

    function stop() {
        anchor = null;
        return connected ? call('PUT', '/hssp/stop').catch(function () { /* ignore */ }) : Promise.resolve();
    }

    function disconnect() { stop(); connected = false; scriptId = null; setupPromise = null; }

    // Where the device should be in the script right now
    function expectedTime() { return anchor ? anchor.startTime + (Date.now() - anchor.wall) : null; }

    return {
        connect: connect, disconnect: disconnect, prepare: prepare, play: play, stop: stop, expectedTime: expectedTime,
        get connected() { return connected; }
    };
})();

// ------------------------------------------------------------------ session player
var FunPlayer = (function () {
    var active = false, cfg = null, sess = null, idx = 0, backend = null, posMs = 0, started = false;
    var onExit = null, hideTimer = null, seekTimer = null, seekTarget = null, driftTimer = null, switching = false;
    var handyOn = false;
    var markedPlayed = false, statsTimer = null, lastSavedPos = 0;
    var TICK_S = 30;   // played time is sent in 30 s steps, the position every 10 s

    function isPlaying() { return !!(backend && started && !switching && !backend.paused()); }

    // Where we are, for "continue" on the TV or the PC (cleared when the session is finished)
    function savePosition(force) {
        if (!sess || (!force && Date.now() - lastSavedPos < 10000)) return;
        lastSavedPos = Date.now();
        var finished = posMs >= sess.totalMs - 5000;
        Fun.saveResume(cfg, finished ? null : sess.id, posMs);
    }

    function $(id) { return document.getElementById(id); }
    var el = {};
    function els() {
        el = { ui: $('player-ui'), title: $('pu-title'), sub: $('pu-sub'), fill: $('pu-fill'), seek: $('pu-seek'),
            time: $('pu-time'), dur: $('pu-dur'), ends: $('pu-ends'), state: $('pu-state'), spinner: $('pu-spinner'), hint: $('pu-hint') };
    }

    function clipLen(c) { return c.endMs - c.startMs; }
    // Which clip a session time falls in
    function clipAt(ms) {
        for (var i = 0; i < sess.clips.length; i++) {
            var c = sess.clips[i];
            if (ms < c.offsetMs + clipLen(c)) return i;
        }
        return sess.clips.length - 1;
    }

    function updateUi() {
        if (!sess) return;
        var c = sess.clips[idx];
        var shown = seekTarget !== null ? seekTarget : posMs;
        el.sub.textContent = t('fun_clip', { i: idx + 1, n: sess.clips.length }) + (c && c.name ? ' · ' + c.name : '') +
            (handyOn ? ' · ' + t('handy_on') : '');
        el.time.textContent = Player.fmt(shown);
        el.dur.textContent = Player.fmt(sess.totalMs);
        el.fill.style.width = Math.min(100, posMs / sess.totalMs * 100) + '%';
        if (seekTarget !== null) { el.seek.style.display = 'block'; el.seek.style.left = Math.min(100, seekTarget / sess.totalMs * 100) + '%'; }
        else el.seek.style.display = 'none';
        el.state.textContent = backend && backend.paused() ? '❚❚' : '▶';
        var end = new Date(Date.now() + Math.max(0, sess.totalMs - shown)), mm = end.getMinutes();
        el.ends.textContent = t('ends_at', { t: end.getHours() + t('time_sep') + (mm < 10 ? '0' : '') + mm });
    }

    function showUi(stay) {
        el.ui.classList.remove('hidden');
        document.body.classList.add('ui-visible');
        updateUi();
        clearTimeout(hideTimer);
        if (!stay && !(backend && backend.paused())) {
            hideTimer = setTimeout(function () { el.ui.classList.add('hidden'); document.body.classList.remove('ui-visible'); }, 4000);
        }
    }

    // Open clip i at offset (ms into the clip). The Handy pauses during the switch and resyncs when the video runs.
    function playClip(i, offset) {
        idx = i;
        var c = sess.clips[i];
        offset = Math.max(0, Math.min(offset || 0, clipLen(c) - 500));
        posMs = c.offsetMs + offset;
        switching = true;
        started = false;
        if (handyOn) Handy.stop();
        if (backend) backend.stop();
        backend = Player.makeBackend();
        backend.open(Fun.mediaUrl(cfg, c.videoId), c.startMs + offset, {
            buffering: function (b) { el.spinner.classList.toggle('hidden', !b); },
            time: onTime,
            started: function () {
                started = true;
                switching = false;
                if (!markedPlayed) { markedPlayed = true; Fun.played(cfg, sess.id); }
                if (handyOn) Handy.play(posMs);
                showUi();
            },
            ended: function () { nextClip(); },
            error: function (e) { App.toast(t('play_error', { e: e && e.message ? e.message : e })); switching = false; nextClip(); }
        });
        updateUi();
    }

    function onTime(ms) {
        if (!sess || switching || !(ms > 0)) return;
        var c = sess.clips[idx];
        if (ms >= c.endMs) { nextClip(); return; }
        posMs = c.offsetMs + Math.max(0, ms - c.startMs);
        savePosition(false);
        if (!el.ui.classList.contains('hidden')) updateUi();
    }

    function nextClip() {
        if (!active || switching) return;   // ignore stray events while a clip is opening
        if (idx + 1 < sess.clips.length) playClip(idx + 1, 0);
        else { posMs = sess.totalMs; stop(); }   // finished: the saved position is cleared
    }

    function seekTo(ms) {
        ms = Math.max(0, Math.min(ms, sess.totalMs - 1000));
        var j = clipAt(ms), c = sess.clips[j];
        if (j === idx && started) {
            posMs = ms;
            backend.seek(c.startMs + (ms - c.offsetMs), function () { if (handyOn && !backend.paused()) Handy.play(posMs); });
        } else {
            playClip(j, ms - c.offsetMs);
        }
        showUi();
    }

    function seekBy(delta) {
        if (!sess || !started) return;
        var base = seekTarget !== null ? seekTarget : posMs;
        seekTarget = Math.max(0, Math.min(sess.totalMs - 1000, base + delta));
        showUi();
        clearTimeout(seekTimer);
        seekTimer = setTimeout(function () { var tgt = seekTarget; seekTarget = null; seekTo(tgt); }, 700);
    }

    function togglePause() {
        if (!backend || !started) return;
        if (backend.paused()) { backend.play(); if (handyOn) Handy.play(posMs); }
        else { backend.pause(); if (handyOn) Handy.stop(); savePosition(true); }
        setTimeout(function () { showUi(); }, 50);
    }

    // startMs: where in the session to begin (from "continue"); 0 = from the start
    async function start(config, sessionId, exitCallback, startMs) {
        els();
        cfg = config; onExit = exitCallback; active = true; idx = 0; posMs = 0; sess = null; handyOn = false;
        markedPlayed = false; lastSavedPos = 0;
        document.body.classList.add('playing');
        el.title.textContent = 'Funscript';
        el.sub.textContent = '';
        el.hint.textContent = t('fun_hint');
        el.spinner.classList.remove('hidden');
        showUi(true);
        try {
            sess = await Fun.session(cfg, sessionId);
        } catch (e) {
            App.toast(t('error', { e: e.message || e }));
            return stop();
        }
        if (!active) return;
        if (!sess.clips || !sess.clips.length) { App.toast(t('fun_no_clips')); return stop(); }
        el.title.textContent = sess.name;
        // Handy (if set up on the PC and sent along when pairing)
        if (cfg.handy && cfg.handy.appId && cfg.handy.key) {
            try {
                if (!Handy.connected) await Handy.connect(cfg.handy.appId, cfg.handy.key);
                await Handy.prepare(sess);
                handyOn = true;
            } catch (e) {
                App.toast(t('handy_error', { e: e.message || e }));
            }
        }
        if (!active) return;
        var from = Math.max(0, Math.min(startMs || 0, sess.totalMs - 5000));
        var first = clipAt(from);
        playClip(first, from - sess.clips[first].offsetMs);
        statsTimer = setInterval(function () { if (isPlaying()) Fun.tick(cfg, TICK_S); }, TICK_S * 1000);
        // Keep the Handy in step with the video (it drifts a little over long sessions)
        driftTimer = setInterval(function () {
            if (!handyOn || !started || switching || !backend || backend.paused()) return;
            var exp = Handy.expectedTime();
            if (exp !== null && Math.abs(exp - posMs) > 300) Handy.play(posMs);
        }, 5000);
    }

    function stop() {
        if (!active) return;
        active = false;
        clearTimeout(hideTimer); clearTimeout(seekTimer); clearInterval(driftTimer); clearInterval(statsTimer);
        seekTarget = null;
        if (started || posMs > 0) savePosition(true);
        if (handyOn) Handy.stop();
        if (backend) backend.stop();
        backend = null; sess = null; started = false; switching = false;
        el.ui.classList.add('hidden');
        el.spinner.classList.add('hidden');
        document.body.classList.remove('playing');
        document.body.classList.remove('ui-visible');
        var cb = onExit; onExit = null;
        if (cb) cb();
    }

    function onKey(k) {
        switch (k) {
            case 13: case 10252: togglePause(); return true;
            case 415: if (backend && backend.paused()) togglePause(); return true;
            case 19: if (backend && !backend.paused()) togglePause(); return true;
            case 37: seekBy(-10000); return true;
            case 39: seekBy(10000); return true;
            case 412: seekBy(-30000); return true;
            case 417: seekBy(30000); return true;
            case 38: if (sess && started) { idx + 1 < sess.clips.length ? playClip(idx + 1, 0) : stop(); } return true;   // next clip
            case 40: if (sess && started) playClip(Math.max(0, idx - 1), 0); return true;                                   // previous clip
            case 10009: case 27: case 8: case 413: stop(); return true;
        }
        showUi();
        return true;
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && active && backend && !backend.paused()) togglePause();
    });

    return { start: start, stop: stop, onKey: onKey, get active() { return active; } };
})();
