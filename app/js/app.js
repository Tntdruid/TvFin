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
        var img = Api.imageUrl(it, wide, wide ? 300 : 420);
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
            '<div class="poster"' + (img ? ' style="background-image:url(\'' + img + '\')"' : '') + '>' +
            (img ? '' : '<span class="poster-fallback">' + esc(it.Name) + '</span>') +
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
        var pos = it.UserData && it.UserData.PlaybackPositionTicks;
        if (pos > 0) {
            openDialog(
                '<h2>' + esc(it.SeriesName ? it.SeriesName + ' – ' + it.Name : it.Name) + '</h2>' +
                '<div class="btn focusable" data-action="resume">▶ Fortsæt fra ' + Player.fmt(pos / 10000) + '</div>' +
                '<div class="btn focusable" data-action="restart">↺ Start forfra</div>',
                function (a) {
                    closeDialog();
                    play(it, a === 'resume' ? pos : 0);
                });
        } else {
            play(it, 0);
        }
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

    return { toast: toast, go: go, back: back };
})();
