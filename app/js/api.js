/* Jellyfin API client. Written without ?. and ?? so it runs on older Tizen TVs. */
var Api = (function () {
    var CLIENT = 'TvFin';
    var VERSION = '1.3.1';
    var STORE_KEY = 'tvfin';
    var isTizen = !!window.tizen;

    // prefs: { audioLang, subLang } – last chosen audio/subtitle language ('off' = no subtitles)
    var state = { server: null, token: null, userId: null, userName: null, serverName: null, deviceId: null, prefs: {} };

    function load() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            for (var k in saved) if (saved.hasOwnProperty(k)) state[k] = saved[k];
        } catch (e) { /* no storage */ }
        if (!state.deviceId) {
            state.deviceId = 'tvfin-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            save();
        }
    }

    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
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

    // Try several paths (new endpoints in Jellyfin 10.9+, old ones as fallback).
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

    // "192.168.1.20" -> tries http://192.168.1.20, :8096, https:// ...
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
            } catch (e) { /* try next */ }
        }
        throw new Error(t('server_not_found', { s: input }));
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
    var FIELDS = 'Fields=PrimaryImageAspectRatio,Overview,ProductionYear,ParentId&EnableImageTypes=Primary,Thumb,Backdrop,Banner&ImageTypeLimit=1';

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
    // Sorting: key -> Jellyfin SortBy and default direction
    var SORTS = {
        name: { by: 'SortName', desc: false },
        added: { by: 'DateCreated,SortName', desc: true },
        released: { by: 'PremiereDate,ProductionYear,SortName', desc: true },
        rating: { by: 'CommunityRating,SortName', desc: true },
        played: { by: 'DatePlayed,SortName', desc: true },
        random: { by: 'Random', desc: false }
    };

    // sort: { key, desc } – omitted for episodes/seasons, which are always in order
    function children(parent, sort) {
        var q = 'ParentId=' + parent.Id + '&Limit=1000&' + FIELDS;
        var s = sort && SORTS[sort.key];
        var sortQ = s ? '&SortBy=' + s.by + '&SortOrder=' + (sort.desc ? 'Descending' : 'Ascending') : '&SortBy=SortName';
        if (parent.CollectionType === 'movies') q += '&Recursive=true&IncludeItemTypes=Movie' + sortQ;
        else if (parent.CollectionType === 'tvshows') q += '&Recursive=true&IncludeItemTypes=Series' + sortQ;
        else if (s) q += sortQ;
        else q += '&SortBy=ParentIndexNumber,IndexNumber,SortName';
        return firstOk('GET', ['/Items?userId=' + state.userId + '&' + q, '/Users/' + state.userId + '/Items?' + q]);
    }
    function search(term) {
        var q = 'searchTerm=' + encodeURIComponent(term) + '&Recursive=true&IncludeItemTypes=Movie,Series,Episode,Video,MusicVideo&Limit=60&' + FIELDS;
        return firstOk('GET', ['/Items?userId=' + state.userId + '&' + q, '/Users/' + state.userId + '/Items?' + q]);
    }
    async function nextEpisode(ep) {
        if (!ep.SeriesId) return null;
        var r = await request('GET', '/Shows/' + ep.SeriesId + '/Episodes?userId=' + state.userId +
            '&StartItemId=' + ep.Id + '&Limit=2&' + FIELDS);
        var list = (r && r.Items) || [];
        if (list.length > 1 && list[0].Id === ep.Id) return list[1];
        return null;
    }
    function subtitleUrl(itemId, mediaSourceId, index) {
        return state.server + '/Videos/' + itemId + '/' + mediaSourceId + '/Subtitles/' + index + '/0/Stream.vtt?api_key=' + state.token;
    }
    function savePrefs(p) {
        state.prefs = state.prefs || {};
        for (var k in p) if (p.hasOwnProperty(k)) state.prefs[k] = p[k];
        save();
    }

    function item(id) {
        return firstOk('GET', ['/Items/' + id + '?userId=' + state.userId, '/Users/' + state.userId + '/Items/' + id]);
    }

    function setPlayed(id, played) {
        return firstOk(played ? 'POST' : 'DELETE',
            ['/UserPlayedItems/' + id + '?userId=' + state.userId, '/Users/' + state.userId + '/PlayedItems/' + id]);
    }
    function setFavorite(id, fav) {
        return firstOk(fav ? 'POST' : 'DELETE',
            ['/UserFavoriteItems/' + id + '?userId=' + state.userId, '/Users/' + state.userId + '/FavoriteItems/' + id]);
    }

    function chapterImageUrl(it, index, tag, height) {
        return state.server + '/Items/' + it.Id + '/Images/Chapter/' + index + '?fillHeight=' + (height || 240) +
            '&quality=80' + (tag ? '&tag=' + tag : '') + '&api_key=' + state.token;
    }
    function backdropUrl(it) {
        if (it.BackdropImageTags && it.BackdropImageTags.length) {
            return state.server + '/Items/' + it.Id + '/Images/Backdrop/0?fillWidth=1920&quality=70&tag=' + it.BackdropImageTags[0] + '&api_key=' + state.token;
        }
        if (it.ParentBackdropItemId && it.ParentBackdropImageTags && it.ParentBackdropImageTags.length) {
            return state.server + '/Items/' + it.ParentBackdropItemId + '/Images/Backdrop/0?fillWidth=1920&quality=70&tag=' + it.ParentBackdropImageTags[0] + '&api_key=' + state.token;
        }
        return null;
    }

    // Banner image (wide 1000x185); falls back to thumb/backdrop.
    function bannerUrls(it, height) {
        var tags = it.ImageTags || {};
        var list = [];
        function u(id, tag) {
            return state.server + '/Items/' + id + '/Images/Banner?fillHeight=' + height + '&quality=85' + (tag ? '&tag=' + tag : '') + '&api_key=' + state.token;
        }
        if (tags.Banner) list.push(u(it.Id, tags.Banner));
        if (it.ParentBannerItemId) list.push(u(it.ParentBannerItemId, it.ParentBannerImageTag));
        if (!tags.Banner) list.push(u(it.Id));
        if (it.SeriesId && !it.ParentBannerItemId) list.push(u(it.SeriesId));
        return list.concat(imageUrls(it, true, height * 2));
    }

    // Returns a prioritized list of image URLs. The app tries them in order (onerror -> next),
    // so cards get an image even if the server doesn't send ImageTags.
    function imageUrls(it, wide, height) {
        var tags = it.ImageTags || {};
        var backs = it.BackdropImageTags || [];
        var parentBacks = it.ParentBackdropImageTags || [];
        var c = [];
        function add(id, type, tag) { if (id) c.push([id, type, tag]); }

        if (wide) {
            if (it.Type === 'Episode' || it.Type === 'Video' || it.PrimaryImageAspectRatio > 1.2) add(it.Id, 'Primary', tags.Primary);
            if (tags.Thumb) add(it.Id, 'Thumb', tags.Thumb);
            if (it.ParentThumbItemId) add(it.ParentThumbItemId, 'Thumb', it.ParentThumbImageTag);
            if (backs.length) add(it.Id, 'Backdrop', backs[0]);
            if (it.ParentBackdropItemId && parentBacks.length) add(it.ParentBackdropItemId, 'Backdrop', parentBacks[0]);
            if (tags.Primary) add(it.Id, 'Primary', tags.Primary);
            // Guesses without tags (only used if the ones above fail)
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
                ContainerProfiles: [], CodecProfiles: [], SubtitleProfiles: SUBTITLE_PROFILES
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
            ContainerProfiles: [], CodecProfiles: [], SubtitleProfiles: SUBTITLE_PROFILES
        };
    }

    // Text subtitles are fetched as WebVTT and rendered by the app itself (no transcoding).
    // Image subtitles (PGS/DVD) are burned in by the server.
    var SUBTITLE_PROFILES = ['vtt', 'webvtt', 'srt', 'subrip', 'ass', 'ssa', 'mov_text', 'ttml', 'sub', 'smi'].map(function (f) {
        return { Format: f, Method: 'External' };
    }).concat(['pgssub', 'pgs', 'dvdsub', 'dvbsub', 'vobsub'].map(function (f) {
        return { Format: f, Method: 'Encode' };
    }));

    // opts: { audioIndex, subIndex, mediaSourceId, noDirectPlay }
    async function playbackInfo(itemId, opts) {
        opts = opts || {};
        var profile = deviceProfile();
        var q = '?userId=' + state.userId + '&IsPlayback=true&AutoOpenLiveStream=true&MaxStreamingBitrate=' + profile.MaxStreamingBitrate;
        if (opts.audioIndex !== undefined && opts.audioIndex !== null) q += '&AudioStreamIndex=' + opts.audioIndex;
        if (opts.subIndex !== undefined && opts.subIndex !== null) q += '&SubtitleStreamIndex=' + opts.subIndex;
        if (opts.mediaSourceId) q += '&MediaSourceId=' + opts.mediaSourceId;
        if (opts.noDirectPlay) q += '&EnableDirectPlay=false';
        var info = await request('POST', '/Items/' + itemId + '/PlaybackInfo' + q, { DeviceProfile: profile });
        var src = info.MediaSources && info.MediaSources[0];
        if (!src) throw new Error(t('no_source'));
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
            throw new Error(t('cannot_play'));
        }
        return {
            url: url, method: method, mediaSourceId: src.Id, playSessionId: info.PlaySessionId, runTimeTicks: src.RunTimeTicks,
            streams: src.MediaStreams || [],
            defaultAudio: src.DefaultAudioStreamIndex, defaultSub: src.DefaultSubtitleStreamIndex
        };
    }

    function report(kind, data) {
        var path = kind === 'start' ? '/Sessions/Playing' : kind === 'stop' ? '/Sessions/Playing/Stopped' : '/Sessions/Playing/Progress';
        return request('POST', path, data).catch(function (e) { console.warn('report ' + kind + ' fejlede', e); });
    }

    function stopEncoding(playSessionId) {
        return request('DELETE', '/Videos/ActiveEncodings?deviceId=' + state.deviceId + '&playSessionId=' + playSessionId)
            .catch(function () { /* ignore */ });
    }

    load();

    return {
        state: state, isTizen: isTizen, connect: connect, logout: logout, validateSession: validateSession,
        qcInitiate: qcInitiate, qcCheck: qcCheck, qcAuthenticate: qcAuthenticate,
        resume: resume, nextUp: nextUp, views: views, children: children, item: item, imageUrls: imageUrls, bannerUrls: bannerUrls, chapterImageUrl: chapterImageUrl, backdropUrl: backdropUrl,
        setPlayed: setPlayed, setFavorite: setFavorite, search: search, nextEpisode: nextEpisode,
        subtitleUrl: subtitleUrl, savePrefs: savePrefs, SORTS: SORTS,
        playbackInfo: playbackInfo, report: report, stopEncoding: stopEncoding
    };
})();
