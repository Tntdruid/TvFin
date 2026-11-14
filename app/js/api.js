/* Jellyfin API-klient. Skrevet uden ?. og ?? så den kører på ældre Tizen-TV'er. */
var Api = (function () {
    var CLIENT = 'TvFin';
    var VERSION = '1.0.0';
    var STORE_KEY = 'tvfin';
    var isTizen = !!window.tizen;

    var state = { server: null, token: null, userId: null, userName: null, serverName: null, deviceId: null };

    function load() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            for (var k in saved) if (saved.hasOwnProperty(k)) state[k] = saved[k];
        } catch (e) { /* ingen lagring */ }
        if (!state.deviceId) {
            state.deviceId = 'tvfin-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            save();
        }
    }

    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorer */ }
    }

    function deviceName() { return isTizen ? 'Samsung TV' : 'Browser'; }

    function authHeader() {
        var h = 'MediaBrowser Client="' + CLIENT + '", Device="' + deviceName() + '", DeviceId="' +
            state.deviceId + '", Version="' + VERSION + '"';
        if (state.token) h += ', Token="' + state.token + '"';
        return h;
    }

    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('Timeout')); }, ms);
            promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
        });
    }

    async function request(method, path, body, server, timeoutMs) {
        var headers = { 'Authorization': authHeader() };
        var opts = { method: method, headers: headers };
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        var res = await withTimeout(fetch((server || state.server) + path, opts), timeoutMs || 15000);
        if (!res.ok) {
            var err = new Error('HTTP ' + res.status);
            err.status = res.status;
            throw err;
        }
        var text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    // Prøv flere stier (nye endpoints i Jellyfin 10.9+, gamle som fallback).
    async function firstOk(method, paths, body) {
        var lastErr;
        for (var i = 0; i < paths.length; i++) {
            try { return await request(method, paths[i], body); } catch (e) {
                lastErr = e;
                if (e.status !== 404 && e.status !== 405) throw e;
            }
        }
        throw lastErr;
    }

    // "192.168.1.20" -> prøver http://192.168.1.20, :8096, https:// ...
    function candidates(input) {
        var s = (input || '').trim().replace(/\/+$/, '');
        if (!s) return [];
        if (/^https?:\/\//i.test(s)) {
            var list = [s];
            if (!/:\d+(\/|$)/.test(s.replace(/^https?:\/\//i, ''))) list.push(s + ':8096');
            return list;
        }
        var hasPort = /:\d+(\/|$)/.test(s);
        return hasPort ? ['http://' + s, 'https://' + s] : ['http://' + s + ':8096', 'http://' + s, 'https://' + s];
    }

    async function connect(input) {
        var list = candidates(input);
        for (var i = 0; i < list.length; i++) {
            try {
                var info = await request('GET', '/System/Info/Public', undefined, list[i], 5000);
                if (info && info.Id) {
                    if (state.server !== list[i]) { state.token = null; state.userId = null; }
                    state.server = list[i];
                    state.serverName = info.ServerName;
                    save();
                    return info;
                }
            } catch (e) { /* prøv næste */ }
        }
        throw new Error('Kunne ikke finde en Jellyfin-server på "' + input + '"');
    }

    // ---- Quick Connect ----
    async function qcInitiate() {
        try { return await request('POST', '/QuickConnect/Initiate'); } catch (e) {
            if (e.status === 404 || e.status === 405) return await request('GET', '/QuickConnect/Initiate');
            throw e;
        }
    }
    function qcCheck(secret) {
        return request('GET', '/QuickConnect/Connect?secret=' + encodeURIComponent(secret));
    }
    async function qcAuthenticate(secret) {
        var r = await request('POST', '/Users/AuthenticateWithQuickConnect', { Secret: secret });
        setAuth(r);
        return r;
    }
    function setAuth(r) {
        state.token = r.AccessToken;
        state.userId = r.User.Id;
        state.userName = r.User.Name;
        save();
    }

    async function logout() {
        try { await request('POST', '/Sessions/Logout'); } catch (e) { /* ligegyldigt */ }
        state.token = null; state.userId = null; state.userName = null;
        save();
    }

    async function validateSession() {
        try { await request('GET', '/Users/Me', undefined, undefined, 8000); return true; } catch (e) {
            if (e.status === 401) { state.token = null; save(); return false; }
            throw e;
        }
    }

    // ---- Data ----
    var FIELDS = 'Fields=PrimaryImageAspectRatio,Overview,ProductionYear,ParentId&EnableImageTypes=Primary,Thumb,Backdrop&ImageTypeLimit=1';

    function resume() {
        var q = 'MediaTypes=Video&Limit=24&' + FIELDS;
        return firstOk('GET', ['/UserItems/Resume?userId=' + state.userId + '&' + q, '/Users/' + state.userId + '/Items/Resume?' + q]);
    }
    function nextUp() {
        return request('GET', '/Shows/NextUp?userId=' + state.userId + '&Limit=24&' + FIELDS);
    }
    function views() {
        return firstOk('GET', ['/UserViews?userId=' + state.userId, '/Users/' + state.userId + '/Views']);
    }
    function children(parent) {
        var q = 'ParentId=' + parent.Id + '&Limit=1000&' + FIELDS;
        if (parent.CollectionType === 'movies') q += '&Recursive=true&IncludeItemTypes=Movie&SortBy=SortName';
        else if (parent.CollectionType === 'tvshows') q += '&Recursive=true&IncludeItemTypes=Series&SortBy=SortName';
        else q += '&SortBy=ParentIndexNumber,IndexNumber,SortName';
        return firstOk('GET', ['/Items?userId=' + state.userId + '&' + q, '/Users/' + state.userId + '/Items?' + q]);
    }
    function item(id) {
        return firstOk('GET', ['/Items/' + id + '?userId=' + state.userId, '/Users/' + state.userId + '/Items/' + id]);
    }

    // Returnerer en prioriteret liste af billed-URL'er. Appen prøver dem i rækkefølge (onerror -> næste),
    // så kort får et billede selv hvis serveren ikke sender ImageTags med.
    function imageUrls(it, wide, height) {
        var tags = it.ImageTags || {};
        var backs = it.BackdropImageTags || [];
        var parentBacks = it.ParentBackdropImageTags || [];
        var c = [];
        function add(id, type, tag) { if (id) c.push([id, type, tag]); }

        if (wide) {
            if (it.Type === 'Episode') add(it.Id, 'Primary', tags.Primary);
            if (tags.Thumb) add(it.Id, 'Thumb', tags.Thumb);
            if (it.ParentThumbItemId) add(it.ParentThumbItemId, 'Thumb', it.ParentThumbImageTag);
            if (backs.length) add(it.Id, 'Backdrop', backs[0]);
            if (it.ParentBackdropItemId && parentBacks.length) add(it.ParentBackdropItemId, 'Backdrop', parentBacks[0]);
            if (tags.Primary) add(it.Id, 'Primary', tags.Primary);
            // Gæt uden tags (bruges kun hvis de foregående fejler)
            add(it.Id, 'Thumb'); add(it.Id, 'Backdrop'); add(it.Id, 'Primary');
            if (it.SeriesId) { add(it.SeriesId, 'Thumb'); add(it.SeriesId, 'Backdrop'); }
        } else {
            if (tags.Primary) add(it.Id, 'Primary', tags.Primary);
            if (it.SeriesId && it.SeriesPrimaryImageTag) add(it.SeriesId, 'Primary', it.SeriesPrimaryImageTag);
            add(it.Id, 'Primary');
            if (it.SeriesId) add(it.SeriesId, 'Primary');
        }

        var seen = {}, out = [];
        c.forEach(function (x) {
            var k = x[0] + '/' + x[1];
            if (seen[k]) return;
            seen[k] = true;
            out.push(state.server + '/Items/' + x[0] + '/Images/' + x[1] + '?fillHeight=' + (height || 360) +
                '&quality=85' + (x[2] ? '&tag=' + x[2] : '') + '&api_key=' + state.token);
        });
        return out;
    }

    // ---- Afspilning ----
    function deviceProfile() {
        if (isTizen) {
            return {
                MaxStreamingBitrate: 120000000,
                MaxStaticBitrate: 120000000,
                DirectPlayProfiles: [{
                    Type: 'Video',
                    Container: 'mp4,m4v,mkv,webm,mov,ts,m2ts,mpegts',
                    VideoCodec: 'h264,hevc,vp9,av1,mpeg4,mpeg2video',
                    AudioCodec: 'aac,mp3,ac3,eac3,opus,flac,vorbis,mp2'
                }],
                TranscodingProfiles: [{
                    Type: 'Video', Container: 'ts', Protocol: 'hls', Context: 'Streaming',
                    VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3,eac3',
                    MaxAudioChannels: '6', MinSegments: 1, BreakOnNonKeyFrames: true
                }],
                ContainerProfiles: [], CodecProfiles: [], SubtitleProfiles: []
            };
        }
        return {
            MaxStreamingBitrate: 40000000,
            MaxStaticBitrate: 40000000,
            DirectPlayProfiles: [
                { Type: 'Video', Container: 'mp4,m4v', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
                { Type: 'Video', Container: 'webm', VideoCodec: 'vp9,vp8,av1', AudioCodec: 'opus,vorbis' }
            ],
            TranscodingProfiles: [{
                Type: 'Video', Container: 'ts', Protocol: 'hls', Context: 'Streaming',
                VideoCodec: 'h264', AudioCodec: 'aac', MaxAudioChannels: '2', MinSegments: 1, BreakOnNonKeyFrames: true
            }],
            ContainerProfiles: [], CodecProfiles: [], SubtitleProfiles: []
        };
    }

    async function playbackInfo(itemId) {
        var profile = deviceProfile();
        var info = await request('POST', '/Items/' + itemId + '/PlaybackInfo?userId=' + state.userId +
            '&IsPlayback=true&AutoOpenLiveStream=true&MaxStreamingBitrate=' + profile.MaxStreamingBitrate,
            { DeviceProfile: profile });
        var src = info.MediaSources && info.MediaSources[0];
        if (!src) throw new Error('Ingen afspillelig kilde');
        var url, method;
        if (src.SupportsDirectPlay) {
            method = 'DirectPlay';
            url = state.server + '/Videos/' + itemId + '/stream?static=true&mediaSourceId=' + src.Id +
                '&deviceId=' + state.deviceId + '&api_key=' + state.token + (src.ETag ? '&Tag=' + src.ETag : '');
        } else if (src.TranscodingUrl) {
            method = src.SupportsDirectStream ? 'DirectStream' : 'Transcode';
            url = state.server + src.TranscodingUrl;
            if (url.indexOf('api_key=') < 0 && url.indexOf('ApiKey=') < 0) url += '&api_key=' + state.token;
        } else {
            throw new Error('Serveren kan ikke afspille denne fil');
        }
        return { url: url, method: method, mediaSourceId: src.Id, playSessionId: info.PlaySessionId, runTimeTicks: src.RunTimeTicks };
    }

    function report(kind, data) {
        var path = kind === 'start' ? '/Sessions/Playing' : kind === 'stop' ? '/Sessions/Playing/Stopped' : '/Sessions/Playing/Progress';
        return request('POST', path, data).catch(function (e) { console.warn('report ' + kind + ' fejlede', e); });
    }

    function stopEncoding(playSessionId) {
        return request('DELETE', '/Videos/ActiveEncodings?deviceId=' + state.deviceId + '&playSessionId=' + playSessionId)
            .catch(function () { /* ignorer */ });
    }

    load();

    return {
        state: state, isTizen: isTizen, connect: connect, logout: logout, validateSession: validateSession,
        qcInitiate: qcInitiate, qcCheck: qcCheck, qcAuthenticate: qcAuthenticate,
        resume: resume, nextUp: nextUp, views: views, children: children, item: item, imageUrls: imageUrls,
        playbackInfo: playbackInfo, report: report, stopEncoding: stopEncoding
    };
})();
