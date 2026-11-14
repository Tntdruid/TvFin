/* Skærme, routing og fjernbetjening. */
var App = (function () {
    var root = document.getElementById('app');
    var stack = [];          // [{ name, params, focusKey }]
    var screen = null;       // aktiv skærm-instans
    var dialog = null;

    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var toastTimer;
    function toast(msg) {
        var t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 5000);
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
        screen = Screens[entry.name](entry.params);
        root.innerHTML = '<div class="loading">Indlæser…</div>';
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
            root.innerHTML = '<div class="center-box"><h1>Noget gik galt</h1><p class="muted">' + esc(e.message || e) +
                '</p><div class="btn focusable" data-action="retry" data-key="retry">Prøv igen</div>' +
                '<div class="btn focusable" data-action="server" data-key="server">Skift server</div></div>';
            Nav.setScope(root);
            Nav.focusFirst();
            screen = {
                action: function (a) { if (a === 'retry') render(); else go('server', {}, true); }
            };
        }
    }

    // ---------- Dialog ----------
    function openDialog(html, onAction) {
        closeDialog();
        dialog = { prevFocus: Nav.current, onAction: onAction, el: document.createElement('div') };
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
        Nav.setScope(root);
        if (d.prevFocus && root.contains(d.prevFocus)) Nav.focus(d.prevFocus); else Nav.focusFirst();
    }

    // ---------- Kort ----------
    function isWide(it) { return it.Type === 'Episode' || it.Type === 'Video' || it.Type === 'CollectionFolder' || it.Type === 'UserView'; }

    function card(it, wide, keyPrefix) {
        var urls = Api.imageUrls(it, wide, wide ? 300 : 420);
        var ud = it.UserData || {};
        var pct = ud.PlayedPercentage || 0;
        var title = it.Name, sub = '';
        if (it.Type === 'Episode') {
            title = it.SeriesName || it.Name;
            sub = 'S' + (it.ParentIndexNumber || 0) + ':E' + (it.IndexNumber || 0) + ' · ' + it.Name;
            if (keyPrefix === 'lib') { title = (it.IndexNumber ? it.IndexNumber + '. ' : '') + it.Name; sub = ''; }
        } else if (it.ProductionYear && !it.IsFolder) {
            sub = String(it.ProductionYear);
        }
        return '<div class="card focusable' + (wide ? ' wide' : '') + '" data-key="' + keyPrefix + '-' + it.Id + '" data-id="' + it.Id + '" data-action="item">' +
            '<div class="poster"><span class="poster-fallback">' + esc(it.Name) + '</span>' +
            (urls.length ? '<img class="poster-img" src="' + esc(urls[0]) + '" data-alt="' + esc(urls.slice(1).join('|')) +
                '" onerror="App.imgErr(this)" alt="">' : '') +
            (ud.Played ? '<span class="badge">✓</span>' : '') +
            (pct > 0 && pct < 100 ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' : '') +
            '</div><div class="card-title">' + esc(title) + '</div>' +
            (sub ? '<div class="card-sub">' + esc(sub) + '</div>' : '') + '</div>';
    }

    function row(title, items, wide, key) {
        if (!items.length) return '';
        return '<section class="row"><h2>' + esc(title) + '</h2><div class="row-items" data-scroll="x">' +
            items.map(function (it) { return card(it, wide, key); }).join('') + '</div></section>';
    }

    // Fælles håndtering af et valgt element (mappe -> åbn, video -> afspil).
    function openItem(it) {
        if (it.IsFolder || it.Type === 'CollectionFolder' || it.Type === 'UserView') {
            go('library', { item: it });
            return;
        }
        go('detail', { item: it });
    }

    // Gem fokus og tegn den aktuelle skærm igen (fx efter "set"/favorit).
    function refresh() {
        var entry = stack[stack.length - 1];
        if (entry && Nav.current) entry.focusKey = Nav.current.getAttribute('data-key');
        render();
    }

    function runtimeText(ticks) {
        var min = Math.round(ticks / 600000000);
        var h = Math.floor(min / 60);
        return h ? h + 't ' + (min % 60) + 'm' : min + 'm';
    }

    function clock(d) {
        var m = d.getMinutes();
        return d.getHours() + '.' + (m < 10 ? '0' : '') + m;
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
        if (video) lines.push(['Video', video.DisplayTitle || ((video.Height ? video.Height + 'p ' : '') + (video.Codec || '').toUpperCase())]);
        if (audio) lines.push(['Lyd', audio.DisplayTitle || audio.Codec]);
        if (subs.length) lines.push(['Undertekster', subs.join(', ')]);
        return lines;
    }

    function play(it, ticks) {
        var entry = stack[stack.length - 1];
        if (entry && Nav.current) entry.focusKey = Nav.current.getAttribute('data-key');
        Player.start(it, ticks, function () { render(); });
    }

    // ---------- Skærme ----------
    var Screens = {};

    Screens.server = function () {
        var s = {
            initialFocus: '#server-input',
            render: function () {
                var prev = Api.state.server ? Api.state.server.replace(/^https?:\/\//, '') : '';
                return '<div class="center-box">' +
                    '<div class="logo big">TvFin</div>' +
                    '<h1>Forbind til din Jellyfin-server</h1>' +
                    '<p class="muted">Indtast IP-adresse eller adresse, f.eks. <b>192.168.1.20</b> eller <b>jellyfin.mitdomæne.dk</b></p>' +
                    '<input id="server-input" class="input focusable" data-key="input" data-submit="connect" type="text" value="' + esc(prev) + '" placeholder="192.168.1.20" autocomplete="off">' +
                    '<div class="btn focusable primary" data-action="connect" data-key="connect">Forbind</div>' +
                    '<p class="error" id="server-error"></p></div>';
            },
            action: async function (a) {
                if (a !== 'connect') return;
                var input = document.getElementById('server-input');
                var err = document.getElementById('server-error');
                err.textContent = 'Forbinder…';
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
                msg.textContent = e.status === 401 || e.status === 403
                    ? 'Quick Connect er slået fra på serveren. Slå det til under Kontrolpanel → Generelt → "Aktivér Quick Connect".'
                    : 'Kunne ikke hente kode: ' + e.message;
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
                if (e.status === 404 || e.status === 401) { stopPoll(); startQc(); }  // kode udløbet
            }
        }
        return {
            initialFocus: '[data-action="newcode"]',
            render: function () {
                return '<div class="center-box">' +
                    '<div class="logo big">TvFin</div>' +
                    '<h1>Log ind med Quick Connect</h1>' +
                    '<p class="muted">Åbn Jellyfin på din telefon eller computer → <b>Profil</b> → <b>Quick Connect</b> og indtast koden:</p>' +
                    '<div class="qc-code" id="qc-code">······</div>' +
                    '<p class="muted small">Server: ' + esc(Api.state.serverName || Api.state.server) + '</p>' +
                    '<p class="error" id="qc-msg"></p>' +
                    '<div class="btn-row"><div class="btn focusable" data-action="newcode" data-key="newcode">Ny kode</div>' +
                    '<div class="btn focusable" data-action="server" data-key="server">Skift server</div></div></div>';
            },
            mounted: startQc,
            destroy: function () { alive = false; stopPoll(); },
            action: function (a) {
                if (a === 'newcode') startQc();
                if (a === 'server') go('server', {}, true);
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
                    var t = v.CollectionType;
                    return !t || t === 'movies' || t === 'tvshows' || t === 'homevideos' || t === 'musicvideos' || t === 'boxsets' || t === 'folders';
                }));
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div>' +
                    '<div class="who">' + esc(Api.state.userName || '') + ' · ' + esc(Api.state.serverName || '') + '</div>' +
                    '<div class="btn small focusable" data-action="logout" data-key="logout">Log ud</div></header>';
                html += row('Fortsæt med at se', resume, true, 'resume');
                html += row('Næste afsnit', next, true, 'next');
                html += row('Biblioteker', libs, true, 'lib');
                if (!resume.length && !next.length && !libs.length) html += '<p class="muted pad">Ingen biblioteker fundet.</p>';
                return html + '</div>';
            },
            initialFocus: '.row .card',
            action: async function (a, el) {
                if (a === 'logout') {
                    await Api.logout();
                    stack = [];
                    go('login');
                } else if (a === 'item') {
                    openItem(items[el.getAttribute('data-id')]);
                }
            }
        };
    };

    Screens.library = function (params) {
        var parent = params.item, items = {};
        return {
            render: async function () {
                var r = await Api.children(parent);
                var list = r.Items || [];
                list.forEach(function (it) { items[it.Id] = it; });
                var head = parent.SeriesName ? parent.SeriesName + ' – ' + parent.Name : parent.Name;
                var html = '<div class="screen" data-scroll="y"><header class="topbar"><div class="logo">TvFin</div><div class="who">' + esc(head) + '</div></header>';
                if (parent.Overview && (parent.Type === 'Series' || parent.Type === 'Season')) {
                    html += '<p class="overview">' + esc(parent.Overview) + '</p>';
                }
                html += '<div class="grid">' + list.map(function (it) { return card(it, isWide(it), 'lib'); }).join('') + '</div>';
                if (!list.length) html += '<p class="muted pad">Tom.</p>';
                return html + '</div>';
            },
            initialFocus: '.grid .card',
            action: function (a, el) {
                if (a === 'item') openItem(items[el.getAttribute('data-id')]);
            }
        };
    };

    Screens.detail = function (params) {
        var it = params.item;
        return {
            initialFocus: '[data-action="play"]',
            render: async function () {
                it = await Api.item(params.item.Id);
                var ud = it.UserData || {};
                var pos = ud.PlaybackPositionTicks || 0;
                var wide = it.Type === 'Episode' || it.Type === 'Video' || it.PrimaryImageAspectRatio > 1.2;
                var urls = Api.imageUrls(it, wide, 540);
                var backdrop = Api.backdropUrl(it);

                // Meta-linje: år · spilletid · slutter kl.
                var meta = [];
                if (it.ProductionYear) meta.push(it.ProductionYear);
                if (it.RunTimeTicks) {
                    meta.push(runtimeText(it.RunTimeTicks));
                    meta.push('Slutter ' + clock(new Date(Date.now() + (it.RunTimeTicks - pos) / 10000)));
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
                        ? '<div class="btn primary focusable" data-action="play" data-key="play">▶ Fortsæt fra ' + Player.fmt(pos / 10000) + '</div>' +
                          '<div class="btn focusable" data-action="restart" data-key="restart">↺ Start forfra</div>'
                        : '<div class="btn primary focusable" data-action="play" data-key="play">▶ Afspil</div>') +
                    '<div class="btn icon focusable' + (ud.Played ? ' on' : '') + '" data-action="played" data-key="played">✓<span class="tip">' + (ud.Played ? 'Set' : 'Marker som set') + '</span></div>' +
                    '<div class="btn icon focusable' + (ud.IsFavorite ? ' on' : '') + '" data-action="fav" data-key="fav">' + (ud.IsFavorite ? '♥' : '♡') + '<span class="tip">Favorit</span></div>' +
                    '</div></div></div>';

                // Detaljer
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
                if (it.Studios && it.Studios.length) extra.push(['Studio', it.Studios.map(function (s) { return s.Name; }).join(', ')]);
                if (it.Genres && it.Genres.length) extra.push(['Genre', it.Genres.join(', ')]);
                var directors = (it.People || []).filter(function (p) { return p.Type === 'Director'; }).map(function (p) { return p.Name; });
                if (directors.length) extra.push(['Instruktør', directors.join(', ')]);
                if (extra.length) {
                    html += '<table class="detail-table">' + extra.map(function (l) {
                        return '<tr><td>' + esc(l[0]) + '</td><td><b>' + esc(l[1]) + '</b></td></tr>';
                    }).join('') + '</table>';
                }
                html += '</div>';

                // Kapitler / scener
                var chapters = it.Chapters || [];
                if (chapters.length) {
                    html += '<section class="row"><h2>Scener</h2><div class="row-items" data-scroll="x">' +
                        chapters.map(function (c, i) {
                            var img = c.ImageTag ? Api.chapterImageUrl(it, i, c.ImageTag, 240) : null;
                            return '<div class="card wide chapter focusable" data-action="chapter" data-index="' + i + '" data-key="ch-' + i + '">' +
                                '<div class="poster"><span class="poster-fallback">' + esc(c.Name || ('Kapitel ' + (i + 1))) + '</span>' +
                                (img ? '<img class="poster-img" src="' + esc(img) + '" onerror="App.imgErr(this)" alt="">' : '') +
                                '<div class="chapter-label"><b>' + esc(c.Name || ('Kapitel ' + (i + 1))) + '</b><br>' +
                                Player.fmt(c.StartPositionTicks / 10000) + '</div></div></div>';
                        }).join('') + '</div></section>';
                }
                return html + '</div>';
            },
            action: async function (a, el) {
                var ud = it.UserData || {};
                try {
                    if (a === 'play') play(it, ud.PlaybackPositionTicks || 0);
                    else if (a === 'restart') play(it, 0);
                    else if (a === 'chapter') play(it, it.Chapters[+el.getAttribute('data-index')].StartPositionTicks);
                    else if (a === 'played') { await Api.setPlayed(it.Id, !ud.Played); refresh(); }
                    else if (a === 'fav') { await Api.setFavorite(it.Id, !ud.IsFavorite); refresh(); }
                } catch (e) {
                    toast('Fejl: ' + (e.message || e));
                }
            }
        };
    };

    // ---------- Taster ----------
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

    // Mus/klik (praktisk ved test i browser)
    document.addEventListener('click', function (e) {
        if (Player.active) return;
        var el = e.target.closest ? e.target.closest('.focusable') : null;
        if (!el) return;
        Nav.focus(el);
        activate(el);
    });

    function registerTvKeys() {
        try {
            ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (key) {
                try { tizen.tvinputdevice.registerKey(key); } catch (e) { /* ikke tilgængelig */ }
            });
        } catch (e) { /* ikke Tizen */ }
    }

    async function init() {
        registerTvKeys();
        if (!Api.state.server) { go('server'); return; }
        if (!Api.state.token) { go('login'); return; }
        try {
            var ok = await Api.validateSession();
            go(ok ? 'home' : 'login');
        } catch (e) {
            go('home');   // netværksfejl: home viser fejl + "prøv igen"
        }
    }

    init();

    // Billede fejlede: prøv næste URL, eller fjern billedet så navnet ses.
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
