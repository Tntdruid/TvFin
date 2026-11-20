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

    function intifaceUrl(cfg) {
        if (cfg.intifaceUrl) return cfg.intifaceUrl;
        var m = /^https?:\/\/([^:/]+)/i.exec(String(cfg.url || ''));
        return 'ws://' + (m ? m[1] : '127.0.0.1') + ':12345';
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
        config: config, save: save, baseUrl: baseUrl, pair: pair, pairStatus: pairStatus, discover: discover, intifaceUrl: intifaceUrl,
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

    function play(startMs, rate) {
        if (!connected) return Promise.resolve();
        rate = rate || 1;
        var startTime = Math.max(0, Math.round(startMs));
        anchor = { startTime: startTime, wall: Date.now(), rate: rate };
        return call('PUT', '/hssp/play', { start_time: startTime, server_time: Math.round(Date.now() + clockOffset), playback_rate: rate })
            .catch(function (e) { console.warn('Handy play', e); });
    }

    function stop() {
        anchor = null;
        return connected ? call('PUT', '/hssp/stop').catch(function () { /* ignore */ }) : Promise.resolve();
    }

    function disconnect() { stop(); connected = false; scriptId = null; setupPromise = null; }

    // Where the device should be in the script right now
    function expectedTime() { return anchor ? anchor.startTime + (Date.now() - anchor.wall) * anchor.rate : null; }

    return {
        connect: connect, disconnect: disconnect, prepare: prepare, play: play, stop: stop, expectedTime: expectedTime,
        get connected() { return connected; }
    };
})();

// ------------------------------------------------------------------ Intiface (Buttplug v3) for vibrators and strokers
// A tiny Buttplug client over a plain WebSocket (the buttplug library is too modern for older TVs).
// Intiface Central runs on the PC; it must listen on the network ("Listen on all network interfaces").
var Intiface = (function () {
    var ws = null, connected = false, msgId = 1, pending = {}, devices = {}, pingTimer = null, onChange = null;

    function send(type, body) {
        if (!ws || ws.readyState !== 1) return Promise.resolve();
        var id = msgId++;
        var msg = {};
        body = body || {};
        body.Id = id;
        msg[type] = body;
        return new Promise(function (resolve, reject) {
            pending[id] = { resolve: resolve, reject: reject };
            try { ws.send(JSON.stringify([msg])); } catch (e) { delete pending[id]; reject(e); }
            setTimeout(function () { if (pending[id]) { delete pending[id]; resolve(null); } }, 5000);
        });
    }

    // Keep what the device can do: vibration motors (ScalarCmd) and strokers (LinearCmd)
    function addDevice(d) {
        var msgs = d.DeviceMessages || {};
        var motors = (msgs.ScalarCmd || []).map(function (a, i) { return { index: i, type: a.ActuatorType }; })
            .filter(function (a) { return a.type === 'Vibrate' || a.type === 'Oscillate'; });
        devices[d.DeviceIndex] = { index: d.DeviceIndex, name: d.DeviceName, motors: motors,
            linear: (msgs.LinearCmd || []).length, sent: null };
        if (onChange) onChange();
    }

    function handle(m) {
        var type = Object.keys(m)[0], body = m[type] || {};
        if (type === 'DeviceAdded') addDevice(body);
        else if (type === 'DeviceRemoved') { delete devices[body.DeviceIndex]; if (onChange) onChange(); }
        else if (type === 'DeviceList') (body.Devices || []).forEach(addDevice);
        var p = pending[body.Id];
        if (p) { delete pending[body.Id]; if (type === 'Error') p.reject(new Error(body.ErrorMessage || 'Intiface')); else p.resolve(body); }
    }

    function connect(url, changed) {
        onChange = changed || null;
        if (connected) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            var done = false;
            try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
            var tm = setTimeout(function () { if (!done) { done = true; reject(new Error('Timeout')); try { ws.close(); } catch (e) { /* ignore */ } } }, 6000);
            ws.onmessage = function (ev) {
                var list = [];
                try { list = JSON.parse(ev.data); } catch (e) { return; }
                list.forEach(handle);
            };
            ws.onclose = function () {
                connected = false; devices = {}; clearInterval(pingTimer);
                if (!done) { done = true; clearTimeout(tm); reject(new Error('closed')); }
                if (onChange) onChange();
            };
            ws.onerror = function () { /* onclose follows */ };
            ws.onopen = async function () {
                try {
                    var info = await send('RequestServerInfo', { ClientName: 'TvFin', MessageVersion: 3 });
                    if (info && info.MaxPingTime > 0) {
                        pingTimer = setInterval(function () { send('Ping'); }, Math.max(500, info.MaxPingTime / 2));
                    }
                    await send('RequestDeviceList');
                    send('StartScanning');
                    setTimeout(function () { send('StopScanning'); }, 15000);
                    connected = true;
                    done = true; clearTimeout(tm);
                    resolve();
                } catch (e) { done = true; clearTimeout(tm); reject(e); }
            };
        });
    }

    function list() { return Object.keys(devices).map(function (k) { return devices[k]; }); }

    // levels: one value 0..1 per motor (motor 2 gets the second value if given)
    function vibrate(d, levels) {
        if (!d.motors.length) return;
        send('ScalarCmd', { DeviceIndex: d.index, Scalars: d.motors.map(function (m, i) {
            return { Index: m.index, Scalar: Math.max(0, Math.min(1, levels[Math.min(i, levels.length - 1)])), ActuatorType: m.type };
        }) });
    }
    function linear(d, pos, duration) {
        send('LinearCmd', { DeviceIndex: d.index, Vectors: [{ Index: 0, Duration: Math.max(30, Math.round(duration)), Position: Math.max(0, Math.min(1, pos)) }] });
    }
    function stopAll() { list().forEach(function (d) { d.sent = null; }); return send('StopAllDevices'); }
    function disconnect() { stopAll(); try { if (ws) ws.close(); } catch (e) { /* ignore */ } ws = null; connected = false; devices = {}; }

    return {
        connect: connect, disconnect: disconnect, list: list, vibrate: vibrate, linear: linear, stopAll: stopAll,
        get connected() { return connected; }
    };
})();

// ------------------------------------------------------------------ session player
var FunPlayer = (function () {
    var active = false, cfg = null, sess = null, idx = 0, backend = null, posMs = 0, started = false;
    var onExit = null, hideTimer = null, seekTimer = null, seekTarget = null, driftTimer = null, switching = false;
    var handyOn = false;
    var markedPlayed = false, statsTimer = null, lastSavedPos = 0;
    // Tempo (50–150 %) is kept between sessions. AVPlay can't play at e.g. 105 %, so then <video> is used.
    var rate = 1, useHtml = false;
    // Intiface: smooth session time between the player's (coarse) time updates, and per-device send state
    var intifaceOn = false, deviceTimer = null, posWall = 0, strokeCursor = -1;
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
            (handyOn ? ' · ' + t('handy_on') : '') +
            (intifaceOn ? ' · ' + t('intiface_devices', { n: Intiface.list().length }) : '') +
            (rate !== 1 ? ' · ' + t('fun_tempo', { p: Math.round(rate * 100) }) : '');
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
        stopDevices();
        if (backend) backend.stop();
        backend = Player.makeBackend(useHtml);
        backend.open(Fun.mediaUrl(cfg, c.videoId), c.startMs + offset, {
            buffering: function (b) { el.spinner.classList.toggle('hidden', !b); },
            time: onTime,
            started: function () {
                started = true;
                switching = false;
                if (!markedPlayed) { markedPlayed = true; Fun.played(cfg, sess.id); }
                if (rate !== 1 && !backend.setRate(rate)) { rate = 1; App.toast(t('fun_tempo_unsupported')); }
                posWall = Date.now();
                if (handyOn) Handy.play(posMs, rate);
                showUi();
            },
            ended: function () { nextClip(); },
            error: function (e) {
                switching = false;
                // <video> (used for tempo) can't play this file on the TV: go back to AVPlay at 100 %
                if (useHtml && Api.isTizen) {
                    useHtml = false; rate = 1;
                    App.toast(t('fun_tempo_unsupported'));
                    playClip(idx, posMs - sess.clips[idx].offsetMs);
                    return;
                }
                App.toast(t('play_error', { e: e && e.message ? e.message : e }));
                nextClip();
            }
        });
        updateUi();
    }

    function onTime(ms) {
        if (!sess || switching || !(ms > 0)) return;
        var c = sess.clips[idx];
        if (ms >= c.endMs) { nextClip(); return; }
        posMs = c.offsetMs + Math.max(0, ms - c.startMs);
        posWall = Date.now();
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
            stopDevices();
            posWall = Date.now();
            backend.seek(c.startMs + (ms - c.offsetMs), function () { if (handyOn && !backend.paused()) Handy.play(posMs, rate); });
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
        if (backend.paused()) { backend.play(); posWall = Date.now(); if (handyOn) Handy.play(posMs, rate); }
        else { backend.pause(); if (handyOn) Handy.stop(); stopDevices(); savePosition(true); }
        setTimeout(function () { showUi(); }, 50);
    }

    // ---- Tempo ----
    function setTempo(r) {
        if (!sess || !started) return;
        r = Math.max(0.5, Math.min(1.5, Math.round(r * 100) / 100));
        if (r === rate) return;
        rate = r;
        if (backend.setRate(rate)) {
            if (handyOn && !backend.paused()) Handy.play(posMs, rate);
            showUi();
        } else if (!useHtml) {
            // AVPlay can't: reopen this clip at the same spot with <video>
            useHtml = true;
            playClip(idx, posMs - sess.clips[idx].offsetMs);
        } else {
            rate = 1;
            App.toast(t('fun_tempo_unsupported'));
        }
    }

    // ---- Intiface devices: vibrators follow vib/vib2, strokers follow the stroke track ----
    function positionAt(actions, tm) {
        if (!actions || !actions.length) return 0;
        var lo = 0, hi = actions.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (actions[mid].at <= tm) lo = mid + 1; else hi = mid; }
        if (lo === 0) return actions[0].pos;
        if (lo >= actions.length) return actions[actions.length - 1].pos;
        var a = actions[lo - 1], b = actions[lo];
        return a.pos + (b.pos - a.pos) * ((tm - a.at) / Math.max(1, b.at - a.at));
    }
    function upperBound(actions, tm) {
        var lo = 0, hi = actions.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (actions[mid].at <= tm) lo = mid + 1; else hi = mid; }
        return lo;
    }

    function stopDevices() {
        strokeCursor = -1;
        if (intifaceOn) Intiface.stopAll();
    }

    function driveDevices() {
        if (!intifaceOn || !isPlaying() || !sess) return;
        var tm = posMs + (Date.now() - posWall) * rate;
        var devs = Intiface.list(), now = Date.now();
        // strokers (e.g. OSR through Intiface)
        var i = upperBound(sess.actions, tm);
        if (i !== strokeCursor && i < sess.actions.length) {
            strokeCursor = i;
            var next = sess.actions[i];
            devs.forEach(function (d) { if (d.linear) Intiface.linear(d, next.pos / 100, (next.at - tm) / rate); });
        }
        // vibrators: ~10 commands/s at most, only real changes (plus a keep-alive each second)
        var l1 = (sess.vib && sess.vib.length) ? positionAt(sess.vib, tm) / 100 : 0;
        var l2 = (sess.vib2 && sess.vib2.length) ? positionAt(sess.vib2, tm) / 100 : l1;
        devs.forEach(function (d) {
            if (!d.motors.length || d.linear) return;
            var levels = d.motors.length > 1 ? [l1, l2] : [l1];
            var last = d.sent || { levels: [], at: 0 };
            var changed = levels.some(function (v, m) { return Math.abs(v - (last.levels[m] === undefined ? -1 : last.levels[m])) >= 0.02; });
            if (now - last.at < 100 || (!changed && now - last.at < 1000)) return;
            d.sent = { levels: levels, at: now };
            Intiface.vibrate(d, levels);
        });
    }

    // startMs: where in the session to begin (from "continue"); 0 = from the start
    async function start(config, sessionId, exitCallback, startMs) {
        els();
        cfg = config; onExit = exitCallback; active = true; idx = 0; posMs = 0; sess = null; handyOn = false;
        markedPlayed = false; lastSavedPos = 0; intifaceOn = false; strokeCursor = -1;
        useHtml = rate !== 1;   // smooth tempo needs <video>
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
        // Intiface on the PC (vibrators like Lovense, or strokers) – if switched on in Settings
        if (cfg.intiface) {
            try {
                await Intiface.connect(Fun.intifaceUrl(cfg), function () { if (active && !el.ui.classList.contains('hidden')) updateUi(); });
                intifaceOn = true;
            } catch (e) {
                App.toast(t('intiface_error', { s: Fun.intifaceUrl(cfg) }));
            }
        }
        if (!active) return;
        var from = Math.max(0, Math.min(startMs || 0, sess.totalMs - 5000));
        var first = clipAt(from);
        playClip(first, from - sess.clips[first].offsetMs);
        statsTimer = setInterval(function () { if (isPlaying()) Fun.tick(cfg, TICK_S); }, TICK_S * 1000);
        deviceTimer = setInterval(driveDevices, 50);
        // Keep the Handy in step with the video (it drifts a little over long sessions)
        driftTimer = setInterval(function () {
            if (!handyOn || !started || switching || !backend || backend.paused()) return;
            var exp = Handy.expectedTime();
            if (exp !== null && Math.abs(exp - posMs) > 300) Handy.play(posMs, rate);
        }, 5000);
    }

    function stop() {
        if (!active) return;
        active = false;
        clearTimeout(hideTimer); clearTimeout(seekTimer); clearInterval(driftTimer); clearInterval(statsTimer); clearInterval(deviceTimer);
        stopDevices();
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
            case 427: case 406: setTempo(rate + 0.05); return true;   // CH +, blue: faster
            case 428: case 405: setTempo(rate - 0.05); return true;   // CH −, yellow: slower
            case 404: setTempo(1); return true;                        // green: back to 100 %
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
