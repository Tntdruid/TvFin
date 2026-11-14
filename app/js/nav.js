/* Simpel rumlig navigation til fjernbetjening: finder nærmeste .focusable i pilens retning. */
var Nav = (function () {
    var scope = document;
    var current = null;

    function visible(el) {
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function all() {
        return Array.prototype.slice.call(scope.querySelectorAll('.focusable')).filter(visible);
    }

    function focus(el) {
        if (!el) return;
        if (current) current.classList.remove('focused');
        current = el;
        el.classList.add('focused');
        ensureVisible(el);
    }

    // Ruller forældre-containere (data-scroll="x"/"y") så elementet er synligt.
    function ensureVisible(el) {
        var p = el.parentElement;
        while (p && p !== document.body) {
            var dir = p.getAttribute('data-scroll');
            if (dir) {
                var pr = p.getBoundingClientRect();
                var er = el.getBoundingClientRect();
                if (dir === 'x') {
                    var pad = 60;
                    if (er.left < pr.left + pad) p.scrollLeft -= (pr.left + pad - er.left);
                    else if (er.right > pr.right - pad) p.scrollLeft += (er.right - pr.right + pad);
                } else {
                    var padY = 120;
                    if (er.top < pr.top + padY) p.scrollTop -= (pr.top + padY - er.top);
                    else if (er.bottom > pr.bottom - padY) p.scrollTop += (er.bottom - pr.bottom + padY);
                    if (p.scrollTop < 200 && er.top - pr.top < pr.height / 2) p.scrollTop = 0;
                }
            }
            p = p.parentElement;
        }
    }

    function move(dir) {
        var items = all();
        if (!current || items.indexOf(current) < 0) { focus(items[0]); return; }
        var cr = current.getBoundingClientRect();
        var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
        var best = null, bestScore = Infinity;
        items.forEach(function (el) {
            if (el === current) return;
            var r = el.getBoundingClientRect();
            var x = r.left + r.width / 2, y = r.top + r.height / 2;
            var dx = x - cx, dy = y - cy, score;
            // Midtpunkter bruges, fordi det fokuserede element er forstørret (scale) og kan overlappe naboer.
            if (dir === 'right' || dir === 'left') {
                if (dir === 'right' ? dx <= 1 : dx >= -1) return;
                score = Math.abs(dx) + Math.abs(dy) * 4;
            } else {
                if (dir === 'down' ? dy <= 1 : dy >= -1) return;
                if (Math.abs(dy) < Math.min(cr.height, r.height) / 2) return; // samme række

                // Brug venstrekant eller midte (det der passer bedst), så venstrestillede lister føles naturlige
                score = Math.abs(dy) + Math.min(Math.abs(dx), Math.abs(r.left - cr.left)) * 1.5;
            }
            if (score < bestScore) { bestScore = score; best = el; }
        });
        if (best) focus(best);
    }

    function setScope(el) { scope = el || document; }

    function focusFirst(selector) {
        var el = selector ? scope.querySelector(selector) : null;
        if (!el || !visible(el)) el = all()[0];
        focus(el);
    }

    return {
        move: move, focus: focus, setScope: setScope, focusFirst: focusFirst,
        get current() { return current; }
    };
})();
