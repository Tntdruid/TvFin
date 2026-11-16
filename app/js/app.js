/* Screens, routing and remote control. */
var App = (function () {
    var root = document.getElementById('app');
    var stack = [];          // [{ name, params, focusKey }]
    var screen = null;       // active screen instance
    var dialog = null;

    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var toastTimer;
    function toast(msg) {
        var box = document.getElementById('toast');
        box.textContent = msg;
        box.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { box.classList.add('hidden'); }, 5000);
    }

    // ---------- Router ----------
    function go(name, params, replace) {
        if (screen && stack.length) stack[stack.length - 1].focusKey = Nav.current ? Nav.current.getAttribute('data-key') : null;
        if (replace) stack.pop();
        stack.push({ name: name, params: params || {}, focusKey: null });
        render();
    }

    function back() {
        if (dialog) { closeDialog(); return; }
        // Scrolled down? Back first jumps to the top of the page; the next Back goes back as usual
        var sc = root.querySelector('[data-scroll="y"]');
        var first = screen && screen.initialFocus ? root.querySelector(screen.initialFocus) : null;
        if (sc && sc.scrollTop > 100 && first && Nav.current !== first) {
            Nav.focus(first);
            sc.scrollTop = 0;
            return;
        }
        if (stack.length <= 1) { exitApp(); return; }
        stack.pop();
        render();
    }

    function exitApp() {
        try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* browser */ }
    }

    async function render() {
        if (screen && screen.destroy) screen.destroy();
        var entry = stack[stack.length - 1];
        var token = {};
        render.token = token;
        screen = Screens[entry.name](entry.params, entry);
        root.innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>';
        try {
            var html = await screen.render();
            if (render.token !== token) return;
            root.innerHTML = html;
            Nav.setScope(root);
            if (screen.mounted) screen.mounted();
            var target = entry.focusKey ? root.querySelector('[data-key="' + entry.focusKey + '"]') : null;
            if (target) Nav.focus(target); else Nav.focusFirst(screen.initialFocus);
        } catch (e) {
            if (render.token !== token) return;
            if (e.status === 401) { Api.state.token = null; go('login', {}, true); return; }
            root.innerHTML = '<div class="center-box"><h1>' + esc(t('error_title')) + '</h1><p class="muted">' + esc(e.message || e) +
                '</p><div class="btn focusable" data-action="retry" data-key="retry">' + esc(t('retry')) + '</div>' +
                '<div class="btn focusable" data-action="server" data-key="server">' + esc(t('change_server')) + '</div></div>';
            Nav.setScope(root);
            Nav.focusFirst();
            screen = {
                action: function (a) { if (a === 'retry') render(); else go('server', {}, true); }
            };
        }
    }

    // ---------- Dialog ----------
    function openDialog(html, onAction, onClose) {
        closeDialog();
        dialog = { prevFocus: Nav.current, onAction: onAction, onClose: onClose, el: document.createElement('div') };
        dialog.el.className = 'dialog-backdrop';
        dialog.el.innerHTML = '<div class="dialog">' + html + '</div>';
        document.body.appendChild(dialog.el);
        Nav.setScope(dialog.el);
        Nav.focusFirst();
    }
    function closeDialog() {
        if (!dialog) return;
        var d = dialog;
        dialog = null;
        d.el.parentNode.removeChild(d.el);
        if (d.onClose) d.onClose();
        Nav.setScope(root);
        if (d.prevFocus && root.contains(d.prevFocus)) Nav.focus(d.prevFocus); else Nav.focusFirst();
    }

    // ---------- Cards ----------
    function isWide(it) { return it.Type === 'Episode' || it.Type === 'Video' || it.Type === 'CollectionFolder' || it.Type === 'UserView'; }

    function cardTexts(it, keyPrefix) {
        var title = it.Name, sub = '';
        if (it.Type === 'Episode') {
            title = it.SeriesName || it.Name;
            sub = 'S' + (it.ParentIndexNumber || 0) + ':E' + (it.IndexNumber || 0) + ' · ' + it.Name;
            if (keyPrefix === 'lib') { title = (it.IndexNumber ? it.IndexNumber + '. ' : '') + it.Name; sub = ''; }
        } else if (it.ProductionYear && !it.IsFolder) {
            sub = String(it.ProductionYear);
        }
        return { title: title, sub: sub };
    }

    // Image + fallback name + played badge + progress (shared by all view modes)
    function imageBlock(it, urls) {
        var ud = it.UserData || {};
        var pct = ud.PlayedPercentage || 0;
        return '<span class="poster-fallback">' + esc(it.Name) + '</span>' +
            (urls.length ? '<img class="poster-img" src="' + esc(urls[0]) + '" data-alt="' + esc(urls.slice(1).join('|')) +
                '" onerror="App.imgErr(this)" alt="">' : '') +
            (ud.Played ? '<span class="badge">✓</span>' : '') +
            (pct > 0 && pct < 100 ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' : '');
    }

    // mode: undefined/'auto' | 'poster' | 'posterCard' | 'thumb' | 'thumbCard' | 'banner' | 'list'
    function card(it, wide, keyPrefix, mode) {
        if (mode === 'list') return listItem(it, keyPrefix);
        var cls = 'card focusable';
        var urls;
        if (mode === 'banner') {
            cls += ' banner';
            urls = Api.bannerUrls(it, 300);
        } else {
            if (mode === 'poster' || mode === 'posterCard') wide = false;
            if (mode === 'thumb' || mode === 'thumbCard') wide = true;
            if (wide) cls += ' wide';
            if (mode === 'posterCard' || mode === 'thumbCard') cls += ' boxed';
            urls = Api.imageUrls(it, wide, wide ? 420 : 560);
        }
        var tx = cardTexts(it, keyPrefix);
        return '<div class="' + cls + '" data-key="' + keyPrefix + '-' + it.Id + '" data-id="' + it.Id + '" data-action="item">' +
            '<div class="poster">' + imageBlock(it, urls) + '</div>' +
            '<div class="card-title">' + esc(tx.title) + '</div>' +
            (tx.sub ? '<div class="card-sub">' + esc(tx.sub) + '</div>' : '') + '</div>';
    }

    function listItem(it, keyPrefix) {
        var wide = isWide(it);
        var tx = cardTexts(it, keyPrefix);
        var meta = [];
        if (tx.sub) meta.push(tx.sub);
        if (it.RunTimeTicks && !it.IsFolder) meta.push(runtimeText(it.RunTimeTicks));
        if (it.CommunityRating) meta.push('★ ' + it.CommunityRating.toFixed(1));
        var overview = it.Overview ? it.Overview.replace(/<[^>]+>/g, ' ') : '';
        return '<div class="list-item focusable" data-key="' + keyPrefix + '-' + it.Id + '" data-id="' + it.Id + '" data-action="item">' +
            '<div class="list-img' + (wide ? ' wide' : '') + '">' + imageBlock(it, Api.imageUrls(it, wide, wide ? 240 : 300)) + '</div>' +
            '<div class="list-text"><div class="card-title">' + esc(tx.title) + '</div>' +
            (meta.length ? '<div class="card-sub">' + esc(meta.join('  ·  ')) + '</div>' : '') +
            (overview ? '<div class="list-overview">' + esc(overview) + '</div>' : '') +
            '</div></div>';
    }

    // wide: true/false, or 'auto' to pick per item (posters for movies/series, thumbs for episodes)
    // link: optional { action, id } – makes the heading a focusable "Title ›" link
    function row(title, items, wide, key, link) {
        if (!items.length) return '';
        var head = link
            ? '<span class="row-link focusable" data-action="' + link.action + '" data-id="' + esc(link.id) + '" data-key="hdr-' + esc(key) + '">' + esc(title) + ' ›</span>'
            : esc(title);
        return '<section class="row"><h2>' + head + '</h2><div class="row-items" data-scroll="x">' +
            items.map(function (it) { return card(it, wide === 'auto' ? isWide(it) : wide, key); }).join('') + '</div></section>';
    }

    // User picture, or a colored circle with the first letter
    function avatar(acc, size) {
        var url = Api.userImageUrl(acc);
        var letter = esc(((acc.userName || '?').charAt(0) || '?').toUpperCase());
        var h = 0;
        for (var i = 0; i < (acc.userId || '').length; i++) h = (h * 31 + acc.userId.charCodeAt(i)) % 100000;
        var hue = Math.round(h * 137.508) % 360;   // golden angle: similar IDs still get distinct colors
        return '<span class="avatar ' + (size || '') + '" style="background:hsl(' + hue + ',55%,45%)">' + letter +
            (url ? '<img src="' + esc(url) + '" onerror="this.parentNode.removeChild(this)" alt="">' : '') + '</span>';
    }

    // Common handling of a selected item (folder -> open, video -> info page).
    function openItem(it) {
        if (it.IsFolder || it.Type === 'CollectionFolder' || it.Type === 'UserView') {
            go('library', { item: it });
            return;
        }
        go('detail', { item: it });
    }

    // Save focus and redraw the current screen (e.g. after played/favorite).
    function refresh() {
        var entry = stack[stack.length - 1];
        if (entry && Nav.current) entry.focusKey = Nav.current.getAttribute('data-key');
        render();
    }

    function runtimeText(ticks) {
        var min = Math.round(ticks / 600000000);
        var h = Math.floor(min / 60);
        return h ? t('runtime_hm', { h: h, m: min % 60 }) : t('runtime_m', { m: min });
    }

    function clock(d) {
        var m = d.getMinutes();
        return d.getHours() + t('time_sep') + (m < 10 ? '0' : '') + m;
    }

    function streamLines(it) {
        var src = it.MediaSources && it.MediaSources[0];
        var streams = (src && src.MediaStreams) || it.MediaStreams || [];
        var video = null, audio = null, subs = [];
        streams.forEach(function (s) {
            if (s.Type === 'Video' && !video) video = s;
            else if (s.Type === 'Audio' && (!audio || s.IsDefault && !audio.IsDefault)) audio = s;
            else if (s.Type === 'Subtitle') subs.push(s.Language || s.DisplayTitle || '?');
        });
        var lines = [];
        if (video) lines.push([t('video'), video.DisplayTitle || ((video.Height ? video.Height + 'p ' : '') + (video.Codec || '').toUpperCase())]);
        if (audio) lines.push([t('audio'), audio.DisplayTitle || audio.Codec]);
        if (subs.length) lines.push([t('subtitles'), subs.join(', ')]);
        return lines;
    }

    function play(it, ticks) {
        var entry = stack[stack.length - 1];
        if (entry && Nav.current) entry.focusKey = Nav.current.getAttribute('data-key');
        Player.start(it, ticks, function (last, ended, next) {
            if (next) playNextEpisode(next);                   // from the in-player card
            else if (ended && last && last.Type === 'Episode') upNext(last);
            else render();
        });
    }

    // Start an episode straight away; the info page behind it switches to that episode
    async function playNextEpisode(next) {
        try {
            var full = await Api.item(next.Id);
            var entry = stack[stack.length - 1];
            if (entry && entry.name === 'detail') { entry.params.item = full; entry.focusKey = null; }
            var pos = full.UserData && full.UserData.PlaybackPositionTicks;
            play(full, pos > 0 ? pos : 0);
        } catch (e) {
            toast(t('error', { e: e.message || e }));
            render();
        }
    }

    // After an episode: show "Next episode in 10 sec" and start it automatically.
    async function upNext(last) {
        await render();
        var next = null;
        try { next = await Api.nextEpisode(last); } catch (e) { /* none */ }
        if (!next || Player.active) return;
        var n = 10, timer = null;
        var img = Api.imageUrls(next, true, 300);
        openDialog(
            '<div class="upnext-label">' + esc(t('up_next')) + '</div>' +
            '<div class="upnext-img">' + (img.length ? '<img class="poster-img" src="' + esc(img[0]) + '" data-alt="' + esc(img.slice(1).join('|')) + '" onerror="App.imgErr(this)" alt="">' : '') + '</div>' +
            '<h2>' + esc('S' + (next.ParentIndexNumber || 0) + ':E' + (next.IndexNumber || 0) + ' · ' + next.Name) + '</h2>' +
            '<p class="muted" id="upnext-count">' + esc(t('starts_in', { n: n })) + '</p>' +
            '<div class="btn primary focusable" data-action="now">▶ ' + esc(t('play_now')) + '</div>' +
            '<div class="btn focusable" data-action="cancel">' + esc(t('cancel')) + '</div>',
            function (a) {
                closeDialog();
                if (a === 'now') startNext();
            },
            function () { clearInterval(timer); });
        timer = setInterval(function () {
            n--;
            var c = document.getElementById('upnext-count');
            if (c) c.textContent = t('starts_in', { n: n });
            if (n <= 0) { closeDialog(); startNext(); }
        }, 1000);

        function startNext() { playNextEpisode(next); }
    }

    // ---------- Screens ----------
    var Screens = {};

    Screens.server = function () {
        var s = {
            initialFocus: '#server-input',
            render: function () {
                var prev = Api.state.server ? Api.state.server.replace(/^https?:\/\//, '') : '';
                return '<div class="center-box">' +
                    '<div class="logo big">TvFin</div>' +
                    '<h1>' + esc(t('connect_title')) + '</h1>' +
                    '<p class="muted">' + esc(t('connect_hint')) + '</p>' +
                    '<input id="server-input" class="input focusable" data-key="input" data-submit="connect" type="text" value="' + esc(prev) + '" placeholder="192.168.1.20" autocomplete="off">' +
                    '<div class="btn focusable primary" data-action="connect" data-key="connect">' + esc(t('connect')) + '</div>' +
                    '<p class="error" id="server-error"></p>' +
                    '<div class="btn small focusable" data-action="lang" data-key="lang">🌐 ' + esc(I18n.name) + '</div></div>';
            },
            action: async function (a) {
                if (a === 'lang') { switchLanguage(); return; }
                if (a !== 'connect') return;
                var input = document.getElementById('server-input');
                var err = document.getElementById('server-error');
                err.textContent = t('connecting');
                try {
                    await Api.connect(input.value);
                    go('login', {}, true);
                } catch (e) {
                    err.textContent = e.message;
                }
            }
        };
        return s;
    };

    Screens.login = function () {
        var pollTimer = null, secret = null, alive = true;
        function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
        async function startQc() {
            stopPoll();
            var codeEl = document.getElementById('qc-code'), msg = document.getElementById('qc-msg');
            codeEl.textContent = '······';
            msg.textContent = '';
            try {
                var r = await Api.qcInitiate();
                if (!alive) return;
                secret = r.Secret;
                codeEl.textContent = r.Code;
                pollTimer = setInterval(check, 3000);
            } catch (e) {
                codeEl.textContent = '—';
                msg.textContent = e.status === 401 || e.status === 403 ? t('qc_disabled') : t('qc_error', { e: e.message });
            }
        }
        async function check() {
            if (!secret) return;
            try {
                var r = await Api.qcCheck(secret);
                if (r && r.Authenticated && alive) {
                    stopPoll();
                    await Api.qcAuthenticate(secret);
                    stack = [];
                    go('home');
                }
            } catch (e) {
                if (e.status === 404 || e.status === 401) { stopPoll(); startQc(); }  // code expired
            }
        }
        return {
            initialFocus: '[data-action="newcode"]',
            render: function () {
                return '<div class="center-box">' +
                    '<div class="logo big">TvFin</div>' +
                    '<h1>' + esc(t('qc_title')) + '</h1>' +
                    '<p class="muted">' + esc(t('qc_hint')) + '</p>' +
                    '<div class="qc-code" id="qc-code">······</div>' +
                    '<p class="muted small">' + esc(t('server')) + ': ' + esc(Api.state.serverName || Api.state.server) + '</p>' +
                    '<p class="error" id="qc-msg"></p>' +
                    '<div class="btn-row"><div class="btn focusable" data-action="newcode" data-key="newcode">' + esc(t('new_code')) + '</div>' +
                    '<div class="btn focusable" data-action="server" data-key="server">' + esc(t('change_server')) + '</div></div>' +
                    '<div class="btn small focusable" data-action="lang" data-key="lang">🌐 ' + esc(I18n.name) + '</div></div>';
            },
            mounted: startQc,
            destroy: function () { alive = false; stopPoll(); },
            action: function (a) {
                if (a === 'newcode') startQc();
                if (a === 'server') go('server', {}, true);
                if (a === 'lang') switchLanguage();
            }
        };
    };

    Screens.home = function () {
        var items = {};
        function keep(list) { list.forEach(function (it) { items[it.Id] = it; }); return list; }
        return {
            render: async function () {
                var res = await Promise.all([
                    Api.resume().catch(function () { return { Items: [] }; }),
                    Api.nextUp().catch(function () { return { Items: [] }; }),
                    Api.views()
                ]);
                var resume = keep(res[0].Items || []);
                var resumeIds = {};
                resume.forEach(function (it) { resumeIds[it.Id] = true; });
                var next = keep((res[1].Items || []).filter(function (it) { return !resumeIds[it.Id]; }));
                var libs = keep((res[2].Items || []).filter(function (v) {
                    var ct = v.CollectionType;
                    return !ct || ct === 'movies' || ct === 'tvshows' || ct === 'homevideos' || ct === 'musicvideos' || ct === 'boxsets' || ct === 'folders';
                }));

                // Second round: favorites + "Latest in <library>" (boxsets have no meaningful latest list)
                var latestLibs = libs.filter(function (v) { return v.CollectionType !== 'boxsets'; });
                var more = await Promise.all([Api.favorites().catch(function () { return { Items: [] }; })].concat(
                    latestLibs.map(function (v) { return Api.latest(v.Id).catch(function () { return []; }); })));
                var favs = keep((more[0] && more[0].Items) || []);

                var acc = { userName: Api.state.userName, userId: Api.state.userId, server: Api.state.server, imageTag: Api.state.imageTag };
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div>' +
                    '<div class="who">' + esc(Api.state.serverName || '') + '</div>' +
                    '<div class="btn small focusable" data-action="search" data-key="search">🔍 ' + esc(t('search')) + '</div>' +
                    (Fun.config() ? '<div class="btn small focusable" data-action="funscript" data-key="funscript">🎬 Funscript</div>' : '') +
                    '<div class="btn small focusable" data-action="lang" data-key="lang">🌐 ' + esc(I18n.name) + '</div>' +
                    '<div class="btn small focusable user-btn" data-action="users" data-key="users">' + avatar(acc, 'mini') + esc(Api.state.userName || '') + '</div></header>' +
                    '<div id="update-banner" class="update-banner hidden"></div>';
                html += row(t('continue_watching'), resume, true, 'resume');
                html += row(t('next_up'), next, true, 'next');
                html += row(t('libraries'), libs, true, 'lib');
                html += row(t('favorites'), favs, 'auto', 'fav');
                latestLibs.forEach(function (v, i) {
                    var list = more[i + 1];
                    list = keep((list && list.Items) || list || []);
                    html += row(t('latest_in', { name: v.Name }), list, 'auto', 'latest-' + v.Id, { action: 'latest', id: v.Id });
                });
                if (!resume.length && !next.length && !libs.length) html += '<p class="muted pad">' + esc(t('no_libraries')) + '</p>';
                return html + '</div>';
            },
            initialFocus: '.row .card',
            // Tell the user when a newer TvFin is on GitHub (checked in the background)
            mounted: function () {
                Api.checkUpdate().then(function (v) {
                    var b = document.getElementById('update-banner');
                    if (v && b) { b.textContent = '⬆ ' + t('update_available', { v: v }); b.classList.remove('hidden'); }
                }).catch(function () { /* ignore */ });
            },
            action: async function (a, el) {
                if (a === 'users') {
                    go('users');
                } else if (a === 'latest') {
                    // "Latest in X ›": open the library sorted by date added (newest first), without changing its saved sort
                    go('library', { item: items[el.getAttribute('data-id')], sort: { key: 'added', desc: true } });
                } else if (a === 'search') {
                    go('search', { q: '' });
                } else if (a === 'funscript') {
                    go('funscript');
                } else if (a === 'lang') {
                    switchLanguage();
                } else if (a === 'item') {
                    openItem(items[el.getAttribute('data-id')]);
                }
            }
        };
    };

    // "Who's watching?": pick a saved user, add one with Quick Connect, or sign out
    Screens.users = function () {
        return {
            initialFocus: '.user-card.current',
            render: function () {
                var accs = Api.state.accounts || [];
                var html = '<div class="center-box users">' +
                    '<div class="logo big">TvFin</div><h1>' + esc(t('whos_watching')) + '</h1><div class="user-row">' +
                    accs.map(function (a, i) {
                        return '<div class="user-card focusable' + (Api.isCurrent(a) ? ' current' : '') + '" data-action="pick" data-index="' + i + '" data-key="u-' + esc(a.userId) + '">' +
                            avatar(a, 'big') + '<div class="user-name">' + esc(a.userName) + '</div>' +
                            '<div class="user-server">' + esc(a.serverName || a.server) + '</div></div>';
                    }).join('') +
                    '<div class="user-card add focusable" data-action="add" data-key="add"><span class="avatar big add">+</span>' +
                    '<div class="user-name">' + esc(t('add_user')) + '</div><div class="user-server">Quick Connect</div></div>' +
                    '</div>';
                if (Api.state.token) {
                    html += '<div class="btn small focusable" data-action="logout" data-key="logout">' +
                        esc(t('sign_out_user', { name: Api.state.userName || '' })) + '</div>' +
                        '<div class="btn small focusable" data-action="funscript" data-key="funscript">🎬 ' +
                        esc(Fun.config() ? 'Funscript' : t('fun_connect_btn')) + '</div>';
                }
                return html + '</div>';
            },
            action: async function (a, el) {
                var accs = Api.state.accounts || [];
                if (a === 'pick') {
                    Api.switchTo(accs[+el.getAttribute('data-index')]);
                    stack = [];
                    go('home');
                } else if (a === 'add') {
                    go(Api.state.server ? 'login' : 'server');
                } else if (a === 'funscript') {
                    go(Fun.config() ? 'funscript' : 'funpair');
                } else if (a === 'logout') {
                    await Api.logout();
                    stack = [];
                    go(Api.state.accounts.length ? 'users' : 'login');
                }
            }
        };
    };

    // Sorting is remembered per folder
    var SORT_KEY = 'tvfin-sort';
    var SORT_ORDER = ['name', 'added', 'released', 'rating', 'played', 'random'];
    function loadSorts() { try { return JSON.parse(localStorage.getItem(SORT_KEY) || '{}'); } catch (e) { return {}; } }
    function getSort(id) { return loadSorts()[id] || { key: 'name', desc: false }; }
    function setSort(id, s) {
        var all = loadSorts();
        all[id] = s;
        try { localStorage.setItem(SORT_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    // View mode (posters, thumbs, banner, list …) is remembered per folder
    var VIEW_KEY = 'tvfin-view';
    var VIEW_ORDER = ['auto', 'poster', 'posterCard', 'thumb', 'thumbCard', 'banner', 'list'];
    function loadViews() { try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'); } catch (e) { return {}; } }
    function getView(id) { return loadViews()[id] || 'auto'; }
    function setView(id, v) {
        var all = loadViews();
        all[id] = v;
        try { localStorage.setItem(VIEW_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    // Group a library by channel (studio) – remembered per library
    var GROUP_KEY = 'tvfin-group';
    function loadGroups() { try { return JSON.parse(localStorage.getItem(GROUP_KEY) || '{}'); } catch (e) { return {}; } }
    function getGroup(id) { return loadGroups()[id] || 'none'; }
    function setGroup(id, g) {
        var all = loadGroups();
        all[id] = g;
        try { localStorage.setItem(GROUP_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    // Channel card: logo if the studio has one, otherwise initials
    function channelCard(st) {
        var urls = Api.imageUrls(st, false, 360);
        return '<div class="card channel focusable" data-action="channel" data-id="' + esc(st.Id) + '" data-key="ch-' + esc(st.Id) + '">' +
            '<div class="poster"><span class="poster-fallback initials">' + initials(st.Name) + '</span>' +
            (urls.length ? '<img class="poster-img" src="' + esc(urls[0]) + '" data-alt="' + esc(urls.slice(1).join('|')) + '" onerror="App.imgErr(this)" alt="">' : '') +
            '</div><div class="card-title">' + esc(st.Name) + '</div></div>';
    }

    Screens.library = function (params) {
        var parent = params.item, items = {}, channels = {};
        var sortable = parent.Type !== 'Series' && parent.Type !== 'Season';
        // Saved sort/view are per folder, and per channel inside a library
        var key = parent.studioId ? parent.Id + ':' + parent.studioId : parent.Id;
        // Only whole libraries (not shows, which are already grouped by series) can be grouped by channel
        var groupable = !parent.studioId && (parent.Type === 'CollectionFolder' || parent.Type === 'UserView') && parent.CollectionType !== 'tvshows';
        return {
            render: async function () {
                // Opened from "Latest in … ›" (params.sort): show the newest videos, not the channel list
                var grouped = groupable && !params.sort && getGroup(parent.Id) === 'channel';
                var sort = sortable ? (params.sort || getSort(key)) : null;
                var view = getView(key);
                var head = parent.SeriesName ? parent.SeriesName + ' – ' + parent.Name : parent.Name;
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div><div class="who">' + esc(head) + '</div>';
                if (groupable) {
                    html += '<div class="btn small focusable" data-action="group" data-key="group">📺 ' + esc(t('group')) + ': ' +
                        esc(grouped ? t('group_channel') : t('group_none')) + '</div>';
                }
                if (grouped) {
                    var rs = await Api.studios(parent.Id);
                    var sts = (rs && rs.Items) || [];
                    sts.forEach(function (st) { channels[st.Id] = st; });
                    html += '</header><div class="grid">' + sts.map(channelCard).join('') + '</div>';
                    if (!sts.length) html += '<p class="muted pad">' + esc(t('no_channels')) + '</p>';
                    return html + '</div>';
                }
                var r = await Api.children(parent, sort);
                var list = r.Items || [];
                list.forEach(function (it) { items[it.Id] = it; });
                html += '<div class="btn small focusable" data-action="view" data-key="view">▦ ' + esc(t('view')) + ': ' + esc(t('view_' + view)) + '</div>';
                if (sortable) {
                    html += '<div class="btn small focusable" data-action="sort" data-key="sort">⇅ ' + esc(t('sort')) + ': ' + esc(t('sort_' + sort.key)) + '</div>';
                    if (sort.key !== 'random') {
                        html += '<div class="btn small focusable" data-action="order" data-key="order">' + (sort.desc ? '↓ ' + esc(t('descending')) : '↑ ' + esc(t('ascending'))) + '</div>';
                    }
                }
                html += '</header>';
                if (parent.Overview && (parent.Type === 'Series' || parent.Type === 'Season')) {
                    html += '<p class="overview">' + esc(parent.Overview) + '</p>';
                }
                html += '<div class="grid' + (view === 'list' ? ' list' : '') + '">' +
                    list.map(function (it) { return card(it, isWide(it), 'lib', view); }).join('') + '</div>';
                if (!list.length) html += '<p class="muted pad">' + esc(t('empty')) + '</p>';
                return html + '</div>';
            },
            initialFocus: '.grid [data-action="item"], .grid [data-action="channel"]',
            action: function (a, el) {
                if (a === 'item') openItem(items[el.getAttribute('data-id')]);
                else if (a === 'channel') {
                    var st = channels[el.getAttribute('data-id')];
                    go('library', { item: { Id: parent.Id, Name: st.Name, Type: 'Channel', CollectionType: parent.CollectionType, studioId: st.Id } });
                } else if (a === 'group') {
                    setGroup(parent.Id, getGroup(parent.Id) === 'channel' ? 'none' : 'channel');
                    refresh();
                } else if (a === 'view') {
                    var v = getView(key);
                    setView(key, VIEW_ORDER[(VIEW_ORDER.indexOf(v) + 1) % VIEW_ORDER.length]);
                    refresh();
                } else if (a === 'sort') {
                    var cur = params.sort || getSort(key);
                    delete params.sort;
                    var k = SORT_ORDER[(SORT_ORDER.indexOf(cur.key) + 1) % SORT_ORDER.length];
                    setSort(key, { key: k, desc: Api.SORTS[k].desc });
                    refresh();
                } else if (a === 'order') {
                    var s = params.sort || getSort(key);
                    delete params.sort;
                    setSort(key, { key: s.key, desc: !s.desc });
                    refresh();
                }
            }
        };
    };

    function initials(name) {
        return esc(String(name || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase());
    }

    // Actor card: portrait photo (or initials), name and role
    function personCard(p) {
        var img = Api.personImageUrl(p, 360);
        return '<div class="card person focusable" data-action="person" data-id="' + esc(p.Id) + '" data-key="p-' + esc(p.Id) + '">' +
            '<div class="poster"><span class="poster-fallback initials">' + initials(p.Name) + '</span>' +
            (img ? '<img class="poster-img" src="' + esc(img) + '" onerror="App.imgErr(this)" alt="">' : '') + '</div>' +
            '<div class="card-title">' + esc(p.Name) + '</div>' +
            (p.Role ? '<div class="card-sub">' + esc(p.Role) + '</div>' : '') + '</div>';
    }

    Screens.detail = function (params, entry) {
        var it = params.item;
        var items = {};   // "More like this" items by id
        return {
            initialFocus: '[data-action="play"]',
            render: async function () {
                it = await Api.item(params.item.Id);
                var ud = it.UserData || {};
                var pos = ud.PlaybackPositionTicks || 0;
                var wide = it.Type === 'Episode' || it.Type === 'Video' || it.PrimaryImageAspectRatio > 1.2;
                var urls = Api.imageUrls(it, wide, 540);
                var backdrop = Api.backdropUrl(it);

                // Meta line: year · runtime · ends at
                var meta = [];
                if (it.ProductionYear) meta.push(it.ProductionYear);
                if (it.RunTimeTicks) {
                    meta.push(runtimeText(it.RunTimeTicks));
                    meta.push(t('ends_at', { t: '' }) + clock(new Date(Date.now() + (it.RunTimeTicks - pos) / 10000)));
                }
                if (it.OfficialRating) meta.push(it.OfficialRating);
                if (it.CommunityRating) meta.push('★ ' + it.CommunityRating.toFixed(1));

                var title = it.Name;
                var sup = '';
                if (it.Type === 'Episode') {
                    sup = (it.SeriesName || '') + ' · S' + (it.ParentIndexNumber || 0) + ':E' + (it.IndexNumber || 0);
                }

                var html = '<div class="screen detail" data-scroll="y">';
                if (backdrop) html += '<div class="detail-bg" style="background-image:url(\'' + backdrop + '\')"></div>';
                html += '<div class="detail-top">' +
                    '<div class="detail-img' + (wide ? ' wide' : '') + '"><span class="poster-fallback">' + esc(it.Name) + '</span>' +
                    (urls.length ? '<img class="poster-img" src="' + esc(urls[0]) + '" data-alt="' + esc(urls.slice(1).join('|')) + '" onerror="App.imgErr(this)" alt="">' : '') +
                    (pos > 0 && it.RunTimeTicks ? '<div class="progress"><i style="width:' + Math.min(100, pos / it.RunTimeTicks * 100) + '%"></i></div>' : '') +
                    '</div><div class="detail-info">' +
                    (sup ? '<div class="detail-sup">' + esc(sup) + '</div>' : '') +
                    '<h1>' + esc(title) + '</h1>' +
                    '<div class="detail-meta">' + meta.map(esc).join('<span class="dot">·</span>') + '</div>' +
                    '<div class="detail-actions">' +
                    (pos > 0
                        ? '<div class="btn primary focusable" data-action="play" data-key="play">▶ ' + esc(t('resume_from', { t: Player.fmt(pos / 10000) })) + '</div>' +
                          '<div class="btn focusable" data-action="restart" data-key="restart">↺ ' + esc(t('restart')) + '</div>'
                        : '<div class="btn primary focusable" data-action="play" data-key="play">▶ ' + esc(t('play')) + '</div>') +
                    '<div class="btn icon focusable' + (ud.Played ? ' on' : '') + '" data-action="played" data-key="played">✓<span class="tip">' + esc(ud.Played ? t('played') : t('mark_played')) + '</span></div>' +
                    '<div class="btn icon focusable' + (ud.IsFavorite ? ' on' : '') + '" data-action="fav" data-key="fav">' + (ud.IsFavorite ? '♥' : '♡') + '<span class="tip">' + esc(t('favorite')) + '</span></div>' +
                    '</div></div></div>';

                // Details
                html += '<div class="detail-body">';
                var lines = streamLines(it);
                if (lines.length) {
                    html += '<table class="detail-table">' + lines.map(function (l) {
                        return '<tr><td>' + esc(l[0]) + '</td><td>' + esc(l[1]) + '</td></tr>';
                    }).join('') + '</table>';
                }
                if (it.Overview) {
                    html += '<div class="detail-overview">' + esc(it.Overview.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
                        .replace(/\n/g, '<br>') + '</div>';
                }
                var extra = [];
                if (it.Studios && it.Studios.length) extra.push([t('studio'), it.Studios.map(function (s) { return s.Name; }).join(', ')]);
                if (it.Genres && it.Genres.length) extra.push([t('genre'), it.Genres.join(', ')]);
                var directors = (it.People || []).filter(function (p) { return p.Type === 'Director'; }).map(function (p) { return p.Name; });
                if (directors.length) extra.push([t('director'), directors.join(', ')]);
                if (extra.length) {
                    html += '<table class="detail-table">' + extra.map(function (l) {
                        return '<tr><td>' + esc(l[0]) + '</td><td><b>' + esc(l[1]) + '</b></td></tr>';
                    }).join('') + '</table>';
                }
                html += '</div>';

                // Chapters / scenes
                var chapters = it.Chapters || [];
                if (chapters.length) {
                    html += '<section class="row"><h2>' + esc(t('scenes')) + '</h2><div class="row-items" data-scroll="x">' +
                        chapters.map(function (c, i) {
                            var img = c.ImageTag ? Api.chapterImageUrl(it, i, c.ImageTag, 320) : null;
                            var name = c.Name || t('chapter', { n: i + 1 });
                            return '<div class="card wide chapter focusable" data-action="chapter" data-index="' + i + '" data-key="ch-' + i + '">' +
                                '<div class="poster"><span class="poster-fallback">' + esc(name) + '</span>' +
                                (img ? '<img class="poster-img" src="' + esc(img) + '" onerror="App.imgErr(this)" alt="">' : '') +
                                '<div class="chapter-label"><b>' + esc(name) + '</b><br>' +
                                Player.fmt(c.StartPositionTicks / 10000) + '</div></div></div>';
                        }).join('') + '</div></section>';
                }

                // Cast
                var cast = (it.People || []).filter(function (p) { return p.Type === 'Actor' || p.Type === 'GuestStar'; }).slice(0, 30);
                if (cast.length) {
                    html += '<section class="row"><h2>' + esc(t('cast')) + '</h2><div class="row-items" data-scroll="x">' +
                        cast.map(personCard).join('') + '</div></section>';
                }
                // "More like this" is filled in after the page is shown (see mounted)
                html += '<div id="similar-row"></div>';
                return html + '</div>';
            },
            mounted: function () {
                var shownFor = it.Id;
                Api.similar(it).then(function (r) {
                    var box = document.getElementById('similar-row');
                    var list = (r && r.Items) || [];
                    if (!box || !list.length || shownFor !== it.Id) return;
                    list.forEach(function (x) { items[x.Id] = x; });
                    box.innerHTML = row(t('more_like_this'), list, 'auto', 'sim');
                    // Back from a similar item: put focus back on it
                    var target = entry && entry.focusKey ? box.querySelector('[data-key="' + entry.focusKey + '"]') : null;
                    if (target) Nav.focus(target);
                }).catch(function () { /* none */ });
            },
            action: async function (a, el) {
                var ud = it.UserData || {};
                try {
                    if (a === 'person') {
                        var id = el.getAttribute('data-id');
                        var person = (it.People || []).filter(function (p) { return p.Id === id; })[0];
                        if (person) go('person', { person: person });
                        return;
                    }
                    if (a === 'item') { openItem(items[el.getAttribute('data-id')]); return; }
                    if (a === 'play') play(it, ud.PlaybackPositionTicks || 0);
                    else if (a === 'restart') play(it, 0);
                    else if (a === 'chapter') play(it, it.Chapters[+el.getAttribute('data-index')].StartPositionTicks);
                    else if (a === 'played') { await Api.setPlayed(it.Id, !ud.Played); refresh(); }
                    else if (a === 'fav') { await Api.setFavorite(it.Id, !ud.IsFavorite); refresh(); }
                } catch (e) {
                    toast(t('error', { e: e.message || e }));
                }
            }
        };
    };

    // ---------- Funscript (the PC app) ----------
    // Pairing like Quick Connect: enter the PC's address, the TV shows a code, the user allows it on the PC
    Screens.funpair = function () {
        var pollTimer = null, alive = true;
        function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
        return {
            initialFocus: '#fun-input',
            render: function () {
                return '<div class="center-box">' +
                    '<div class="logo big">🎬 Funscript</div>' +
                    '<h1>' + esc(t('fun_connect_title')) + '</h1>' +
                    '<p class="muted">' + esc(t('fun_connect_hint')) + '</p>' +
                    '<input id="fun-input" class="input focusable" data-key="input" data-submit="connect" type="text" placeholder="192.168.1.20:8001" autocomplete="off">' +
                    '<div class="btn focusable primary" data-action="connect" data-key="connect">' + esc(t('connect')) + '</div>' +
                    '<div id="fun-code-box" class="hidden"><p class="muted">' + esc(t('fun_pair_code')) + '</p><div class="qc-code" id="fun-code"></div></div>' +
                    '<p class="error" id="fun-msg"></p></div>';
            },
            destroy: function () { alive = false; stopPoll(); },
            action: async function (a) {
                if (a !== 'connect') return;
                stopPoll();
                var msg = document.getElementById('fun-msg');
                var input = document.getElementById('fun-input').value;
                var url = Fun.baseUrl(input);
                if (!url) return;
                msg.textContent = t('connecting');
                try {
                    var p = await Fun.pair(url);
                    if (!alive) return;
                    document.getElementById('fun-code').textContent = p.code;
                    document.getElementById('fun-code-box').classList.remove('hidden');
                    msg.textContent = t('fun_waiting');
                    pollTimer = setInterval(async function () {
                        try {
                            var st = await Fun.pairStatus(url, p.id);
                            if (!alive || st.status === 'pending') return;
                            stopPoll();
                            if (st.status === 'approved') {
                                Fun.save({ url: url, key: st.key, handy: st.handy || null });
                                go('funscript', {}, true);
                            } else {
                                document.getElementById('fun-code-box').classList.add('hidden');
                                msg.textContent = st.status === 'denied' ? t('fun_denied') : t('fun_expired');
                            }
                        } catch (e) { /* keep trying */ }
                    }, 2000);
                } catch (e) {
                    msg.textContent = t('fun_unreachable', { s: url });
                }
            }
        };
    };

    // Saved sessions from the PC app
    Screens.funscript = function () {
        var cfg = Fun.config();
        return {
            initialFocus: '[data-action="fun-resume"], .grid [data-action="fun-play"]',
            render: async function () {
                if (!cfg) { go('funpair', {}, true); return ''; }
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div>' +
                    '<div class="who">🎬 Funscript · ' + esc(cfg.handy ? t('handy_ready') : t('handy_none')) + '</div>' +
                    '<div class="btn small focusable" data-action="fun-forget" data-key="fun-forget">' + esc(t('fun_forget')) + '</div></header>';
                var r, resume = null;
                try {
                    var both = await Promise.all([Fun.sessions(cfg), Fun.resume(cfg)]);
                    r = both[0]; resume = both[1];
                } catch (e) {
                    if (e.status === 403) { Fun.save(null); go('funpair', {}, true); return ''; }
                    return html + '<p class="error pad">' + esc(t('fun_unreachable', { s: cfg.url })) + '</p></div>';
                }
                var list = (r && r.sessions) || [];
                // Continue where the last session was left (on the TV or the PC)
                if (resume && resume.ms > 30000 && resume.ms < resume.totalMs - 30000) {
                    html += '<section class="row"><div class="btn primary focusable" data-action="fun-resume" data-id="' + resume.sessionId +
                        '" data-ms="' + resume.ms + '" data-key="fun-resume">▶ ' +
                        esc(t('fun_resume', { name: resume.name, t: Player.fmt(resume.ms) })) + '</div></section>';
                }
                html += '<section class="row"><h2>' + esc(t('fun_sessions')) + '</h2></section><div class="grid list">' + list.map(function (s) {
                    var meta = [Player.fmt(s.totalMs), s.clipCount + ' ' + t('fun_clips')];
                    if (s.createdAt) { var d = new Date(s.createdAt * 1000); meta.push(d.getDate() + '/' + (d.getMonth() + 1) + ' ' + d.getFullYear()); }
                    return '<div class="list-item focusable" data-action="fun-play" data-id="' + s.id + '" data-key="fs-' + s.id + '">' +
                        '<div class="list-img wide"><span class="poster-fallback">🎬</span>' +
                        (s.thumbVideoId ? '<img class="poster-img" src="' + esc(Fun.thumbUrl(cfg, s.thumbVideoId)) + '" onerror="App.imgErr(this)" alt="">' : '') + '</div>' +
                        '<div class="list-text"><div class="card-title">' + esc(s.name) + '</div><div class="card-sub">' + esc(meta.join('  ·  ')) + '</div></div></div>';
                }).join('') + '</div>';
                if (!list.length) html += '<p class="muted pad">' + esc(t('fun_no_sessions')) + '</p>';
                return html + '</div>';
            },
            action: function (a, el) {
                if (a === 'fun-play' || a === 'fun-resume') {
                    var entry = stack[stack.length - 1];
                    if (entry && Nav.current) entry.focusKey = Nav.current.getAttribute('data-key');
                    FunPlayer.start(cfg, el.getAttribute('data-id'), function () { render(); },
                        a === 'fun-resume' ? Number(el.getAttribute('data-ms')) : 0);
                } else if (a === 'fun-forget') {
                    Fun.save(null);
                    stack = [];
                    go('home');
                }
            }
        };
    };

    // A person's movies and series
    Screens.person = function (params) {
        var p = params.person, items = {};
        return {
            initialFocus: '.grid .card',
            render: async function () {
                var res = await Promise.all([Api.item(p.Id).catch(function () { return null; }), Api.personItems(p.Id)]);
                var info = res[0] || p;
                var list = (res[1] && res[1].Items) || [];
                list.forEach(function (x) { items[x.Id] = x; });
                var img = Api.personImageUrl(info.ImageTags ? info : p, 480);
                var meta = [];
                if (info.PremiereDate) meta.push(String(info.PremiereDate).slice(0, 4) + (info.EndDate ? '–' + String(info.EndDate).slice(0, 4) : ''));
                if (info.ProductionLocations && info.ProductionLocations.length) meta.push(info.ProductionLocations[0]);
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div><div class="who">' + esc(p.Name) + '</div></header>' +
                    '<div class="person-top"><div class="person-img"><span class="poster-fallback initials">' + initials(p.Name) + '</span>' +
                    (img ? '<img class="poster-img" src="' + esc(img) + '" onerror="App.imgErr(this)" alt="">' : '') + '</div>' +
                    '<div class="person-info"><h1>' + esc(p.Name) + '</h1>' +
                    (meta.length ? '<div class="detail-meta">' + meta.map(esc).join('<span class="dot">·</span>') + '</div>' : '') +
                    (info.Overview ? '<div class="detail-overview">' + esc(String(info.Overview).replace(/<[^>]+>/g, '')) + '</div>' : '') +
                    '</div></div>';
                html += list.length
                    ? '<div class="grid">' + list.map(function (x) { return card(x, isWide(x), 'lib'); }).join('') + '</div>'
                    : '<p class="muted pad">' + esc(t('empty')) + '</p>';
                return html + '</div>';
            },
            action: function (a, el) {
                if (a === 'item') openItem(items[el.getAttribute('data-id')]);
            }
        };
    };

    Screens.search = function (params, entry) {
        var items = {}, timer = null, lastQ = null, reqId = 0;
        async function run(q) {
            q = (q || '').trim();
            params.q = q;
            if (q === lastQ) return;
            lastQ = q;
            var box = document.getElementById('search-results');
            if (!box) return;
            if (q.length < 2) { box.innerHTML = ''; return; }
            var my = ++reqId;
            try {
                var r = await Api.search(q);
                if (my !== reqId || !document.getElementById('search-results')) return;
                var list = r.Items || [];
                list.forEach(function (it) { items[it.Id] = it; });
                box.innerHTML = list.length
                    ? '<div class="grid">' + list.map(function (it) { return card(it, isWide(it), 'search'); }).join('') + '</div>'
                    : '<p class="muted pad">' + esc(t('no_results')) + '</p>';
                // Back from an info page: restore focus to the selected card
                if (entry.focusKey) {
                    var target = box.querySelector('[data-key="' + entry.focusKey + '"]');
                    if (target) Nav.focus(target);
                    entry.focusKey = null;
                }
            } catch (e) {
                box.innerHTML = '<p class="error pad">' + esc(t('error', { e: e.message || e })) + '</p>';
            }
        }
        return {
            initialFocus: '#search-input',
            render: function () {
                return '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div><div class="who">' + esc(t('search')) + '</div></header>' +
                    '<div class="search-box"><input id="search-input" class="input focusable" data-key="search-input" data-submit="search" type="text" autocomplete="off" placeholder="' +
                    esc(t('search_placeholder')) + '" value="' + esc(params.q || '') + '"></div>' +
                    '<div class="search-hint">' + esc(t('search_hint')) + '</div>' +
                    '<div id="search-results"></div></div>';
            },
            mounted: function () {
                var input = document.getElementById('search-input');
                input.addEventListener('input', function () {
                    clearTimeout(timer);
                    timer = setTimeout(function () { run(input.value); }, 500);
                });
                if (params.q) run(params.q);
            },
            destroy: function () { clearTimeout(timer); },
            action: function (a, el) {
                if (a === 'search') {
                    run(document.getElementById('search-input').value);
                    // After "Done" on the keyboard: jump down to the first result
                    setTimeout(function () {
                        var first = document.querySelector('#search-results .card');
                        if (first) Nav.focus(first);
                    }, 600);
                } else if (a === 'item') {
                    openItem(items[el.getAttribute('data-id')]);
                }
            }
        };
    };

    function switchLanguage() {
        I18n.next();
        refresh();
    }

    // ---------- Keys ----------
    var KEYS = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8, DONE: 65376, CANCEL: 65385 };

    function activate(el) {
        if (!el) return;
        if (el.tagName === 'INPUT') { el.focus(); return; }
        var a = el.getAttribute('data-action');
        if (dialog) { if (dialog.onAction) dialog.onAction(a, el); return; }
        if (screen && screen.action) screen.action(a, el);
    }

    document.addEventListener('keydown', function (e) {
        var k = e.keyCode;
        if (Player.active) { if (Player.onKey(k)) e.preventDefault(); return; }
        if (FunPlayer.active) { if (FunPlayer.onKey(k)) e.preventDefault(); return; }

        var ae = document.activeElement;
        if (ae && ae.tagName === 'INPUT') {
            if (k === KEYS.ENTER || k === KEYS.DONE) {
                e.preventDefault();
                ae.blur();
                var submit = ae.getAttribute('data-submit');
                if (submit && screen && screen.action) screen.action(submit, ae);
            } else if (k === KEYS.BACK || k === KEYS.CANCEL || k === KEYS.ESC) {
                e.preventDefault();
                ae.blur();
            } else if (k === KEYS.DOWN || k === KEYS.UP) {
                e.preventDefault();
                ae.blur();
                Nav.move(k === KEYS.DOWN ? 'down' : 'up');
            }
            return;
        }

        switch (k) {
            case KEYS.LEFT: Nav.move('left'); break;
            case KEYS.RIGHT: Nav.move('right'); break;
            case KEYS.UP: Nav.move('up'); break;
            case KEYS.DOWN: Nav.move('down'); break;
            case KEYS.ENTER: activate(Nav.current); break;
            case KEYS.BACK: case KEYS.ESC: case KEYS.BACKSPACE: back(); break;
            default: return;
        }
        e.preventDefault();
    });

    // Mouse/click (handy when testing in a browser)
    document.addEventListener('click', function (e) {
        if (Player.active || FunPlayer.active) return;
        var el = e.target.closest ? e.target.closest('.focusable') : null;
        if (!el) return;
        Nav.focus(el);
        activate(el);
    });

    function registerTvKeys() {
        try {
            ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (key) {
                try { tizen.tvinputdevice.registerKey(key); } catch (e) { /* not available */ }
            });
        } catch (e) { /* not Tizen */ }
    }

    async function init() {
        registerTvKeys();
        I18n.detectTv(function () { if (stack.length && !Player.active) refresh(); });
        if (!Api.state.server) { go('server'); return; }
        // Several saved users: ask who's watching
        if ((Api.state.accounts || []).length > 1) { go('users'); return; }
        if (!Api.state.token) { go('login'); return; }
        try {
            var ok = await Api.validateSession();
            go(ok ? 'home' : (Api.state.accounts.length ? 'users' : 'login'));
        } catch (e) {
            go('home');   // network error: home shows the error + "try again"
        }
    }

    init();

    // Image failed: try the next URL, or remove the image so the name shows.
    function imgErr(img) {
        var rest = img.getAttribute('data-alt');
        if (rest) {
            var list = rest.split('|');
            img.setAttribute('data-alt', list.slice(1).join('|'));
            img.src = list[0];
        } else if (img.parentNode) {
            img.parentNode.removeChild(img);
        }
    }

    return { toast: toast, go: go, back: back, imgErr: imgErr };
})();
