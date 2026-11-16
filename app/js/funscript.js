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

    function q(cfg) { return '?k=' + encodeURIComponent(cfg.key); }
    function sessions(cfg) { return getJson(cfg.url + '/tv/sessions' + q(cfg)); }
    function session(cfg, id) { return getJson(cfg.url + '/tv/sessions/' + id + q(cfg)); }
    function mediaUrl(cfg, videoId) { return cfg.url + '/tv/media/' + videoId + q(cfg); }
    function thumbUrl(cfg, videoId) { return cfg.url + '/tv/thumb/' + videoId + q(cfg); }

    return {
        config: config, save: save, baseUrl: baseUrl, pair: pair, pairStatus: pairStatus,
        sessions: sessions, session: session, mediaUrl: mediaUrl, thumbUrl: thumbUrl
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
        if (!el.ui.classList.contains('hidden')) updateUi();
    }

    function nextClip() {
        if (!active || switching) return;   // ignore stray events while a clip is opening
        if (idx + 1 < sess.clips.length) playClip(idx + 1, 0);
        else stop();
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
        else { backend.pause(); if (handyOn) Handy.stop(); }
        setTimeout(function () { showUi(); }, 50);
    }

    async function start(config, sessionId, exitCallback) {
        els();
        cfg = config; onExit = exitCallback; active = true; idx = 0; posMs = 0; sess = null; handyOn = false;
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
        playClip(0, 0);
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
        clearTimeout(hideTimer); clearTimeout(seekTimer); clearInterval(driftTimer);
        seekTarget = null;
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
