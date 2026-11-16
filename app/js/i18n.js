/* Translations. The language follows the TV/browser but can be switched on the home screen. */
var I18n = (function () {
    var dict = {
        da: {
            _name: 'Dansk',
            loading: 'Indlæser…', error_title: 'Noget gik galt', retry: 'Prøv igen', error: 'Fejl: {e}',
            connect_title: 'Forbind til din Jellyfin-server',
            connect_hint: 'Indtast IP-adresse eller adresse, f.eks. 192.168.1.20 eller jellyfin.example.com',
            connect: 'Forbind', connecting: 'Forbinder…', server_not_found: 'Kunne ikke finde en Jellyfin-server på "{s}"',
            qc_title: 'Log ind med Quick Connect',
            qc_hint: 'Åbn Jellyfin på din telefon eller computer → Profil → Quick Connect, og indtast koden:',
            qc_disabled: 'Quick Connect er slået fra på serveren. Slå det til under Kontrolpanel → Generelt → "Aktivér Quick Connect".',
            qc_error: 'Kunne ikke hente kode: {e}', new_code: 'Ny kode', change_server: 'Skift server', server: 'Server',
            logout: 'Log ud', search: 'Søg', continue_watching: 'Fortsæt med at se', next_up: 'Næste afsnit',
            libraries: 'Biblioteker', no_libraries: 'Ingen biblioteker fundet.', empty: 'Tom.',
            play: 'Afspil', resume_from: 'Fortsæt fra {t}', restart: 'Start forfra', mark_played: 'Marker som set',
            played: 'Set', favorite: 'Favorit', ends_at: 'Slutter {t}', time_sep: '.',
            video: 'Video', audio: 'Lyd', subtitles: 'Undertekster', studio: 'Studio', genre: 'Genre', director: 'Instruktør',
            scenes: 'Scener', chapter: 'Kapitel {n}', runtime_hm: '{h}t {m}m', runtime_m: '{m}m',
            off: 'Fra', player_hint: '◀ ▶ spol 10 sek · ▲ lyd og undertekster · OK pause · Tilbage stop',
            start_error: 'Kunne ikke starte afspilning: {e}', play_error: 'Afspilningsfejl: {e}',
            no_source: 'Ingen afspillelig kilde', cannot_play: 'Serveren kan ikke afspille denne fil',
            up_next: 'Næste afsnit', starts_in: 'Starter om {n} sek', play_now: 'Afspil nu', cancel: 'Annuller',
            search_placeholder: 'Søg efter film, serier, videoer…', search_hint: 'Tryk OK for at skrive', no_results: 'Ingen resultater',
            language: 'Sprog', unknown: 'Ukendt',
            sort: 'Sortér', sort_name: 'Navn', sort_added: 'Dato tilføjet', sort_released: 'Udgivelsesdato',
            sort_rating: 'Bedømmelse', sort_played: 'Sidst set', sort_random: 'Tilfældig',
            ascending: 'Stigende', descending: 'Faldende',
            view: 'Visning', view_auto: 'Automatisk', view_poster: 'Plakater', view_posterCard: 'Plakatkort',
            view_thumb: 'Tommel', view_thumbCard: 'Tommel kort', view_banner: 'Banner', view_list: 'Liste',
            favorites: 'Favoritter', latest_in: 'Nyligt tilføjet i {name}', whos_watching: 'Hvem ser med?',
            add_user: 'Tilføj bruger', sign_out_user: 'Log {name} ud',
            skip_intro: 'Spring intro over', skip_recap: 'Spring resumé over', skip_preview: 'Spring forsmag over',
            skip_credits: 'Spring rulletekster over', cast: 'Medvirkende', more_like_this: 'Mere som dette', back_hide: 'Tilbage skjul',
            fun_connect_btn: 'Tilslut Funscript', fun_connect_title: 'Forbind til Funscript på PC\'en',
            fun_connect_hint: 'Slå "Styr fra mobilen" til i Funscript-appen, og indtast adressen der står under Fjernbetjening (fx 192.168.1.20:8001).',
            fun_pair_code: 'Tryk Tillad i Funscript-appen på PC\'en. Koden er:', fun_waiting: 'Venter på godkendelse…',
            fun_denied: 'Tv\'et blev afvist på PC\'en.', fun_expired: 'Anmodningen udløb – prøv igen.',
            fun_unreachable: 'Kunne ikke nå Funscript på {s}. Er "Styr fra mobilen" slået til, og kører appen?',
            fun_sessions: 'Sessioner', fun_no_sessions: 'Ingen gemte sessioner endnu – byg en i Funscript-appen.',
            fun_no_clips: 'Sessionen har ingen klip.', fun_forget: 'Glem forbindelse', fun_clip: 'Klip {i}/{n}', fun_clips: 'klip',
            fun_hint: '◀ ▶ spol 10 sek · ▲ næste klip · ▼ forrige klip · OK pause · Tilbage stop',
            handy_ready: 'Handy klar', handy_none: 'uden Handy', handy_on: 'Handy', handy_error: 'Handy: {e}',
            handy_offline: 'Handy er ikke online – tjek at den er på wifi', handy_bad_app: 'Ugyldigt Application ID',
            handy_too_long: 'Sessionen er for lang til Handy', handy_upload_failed: 'Upload af script til Handy fejlede', group: 'Gruppér', group_channel: 'Kanal', group_none: 'Ingen', no_channels: 'Ingen kanaler fundet (videoerne har intet studie/kanal i Jellyfin).', update_available: 'Ny version {v} af TvFin er klar – kør ./update.sh på serveren'
        },
        en: {
            _name: 'English',
            loading: 'Loading…', error_title: 'Something went wrong', retry: 'Try again', error: 'Error: {e}',
            connect_title: 'Connect to your Jellyfin server',
            connect_hint: 'Enter an IP address or hostname, e.g. 192.168.1.20 or jellyfin.example.com',
            connect: 'Connect', connecting: 'Connecting…', server_not_found: 'Could not find a Jellyfin server at "{s}"',
            qc_title: 'Sign in with Quick Connect',
            qc_hint: 'Open Jellyfin on your phone or computer → Profile → Quick Connect, and enter the code:',
            qc_disabled: 'Quick Connect is disabled on the server. Enable it under Dashboard → General → "Enable Quick Connect".',
            qc_error: 'Could not get a code: {e}', new_code: 'New code', change_server: 'Change server', server: 'Server',
            logout: 'Sign out', search: 'Search', continue_watching: 'Continue watching', next_up: 'Next up',
            libraries: 'Libraries', no_libraries: 'No libraries found.', empty: 'Empty.',
            play: 'Play', resume_from: 'Resume from {t}', restart: 'Start over', mark_played: 'Mark as played',
            played: 'Played', favorite: 'Favorite', ends_at: 'Ends at {t}', time_sep: ':',
            video: 'Video', audio: 'Audio', subtitles: 'Subtitles', studio: 'Studio', genre: 'Genre', director: 'Director',
            scenes: 'Scenes', chapter: 'Chapter {n}', runtime_hm: '{h}h {m}m', runtime_m: '{m}m',
            off: 'Off', player_hint: '◀ ▶ seek 10 sec · ▲ audio & subtitles · OK pause · Back stop',
            start_error: 'Could not start playback: {e}', play_error: 'Playback error: {e}',
            no_source: 'No playable source', cannot_play: 'The server cannot play this file',
            up_next: 'Next episode', starts_in: 'Starts in {n} sec', play_now: 'Play now', cancel: 'Cancel',
            search_placeholder: 'Search movies, shows, videos…', search_hint: 'Press OK to type', no_results: 'No results',
            language: 'Language', unknown: 'Unknown',
            sort: 'Sort', sort_name: 'Name', sort_added: 'Date added', sort_released: 'Release date',
            sort_rating: 'Rating', sort_played: 'Last played', sort_random: 'Random',
            ascending: 'Ascending', descending: 'Descending',
            view: 'View', view_auto: 'Automatic', view_poster: 'Posters', view_posterCard: 'Poster cards',
            view_thumb: 'Thumbs', view_thumbCard: 'Thumb cards', view_banner: 'Banners', view_list: 'List',
            favorites: 'Favorites', latest_in: 'Latest in {name}', whos_watching: "Who's watching?",
            add_user: 'Add user', sign_out_user: 'Sign out {name}',
            skip_intro: 'Skip intro', skip_recap: 'Skip recap', skip_preview: 'Skip preview',
            skip_credits: 'Skip credits', cast: 'Cast', more_like_this: 'More like this', back_hide: 'Back hide',
            fun_connect_btn: 'Connect Funscript', fun_connect_title: 'Connect to Funscript on the PC',
            fun_connect_hint: 'Turn on "Control from phone" in the Funscript app, and enter the address shown under Remote (e.g. 192.168.1.20:8001).',
            fun_pair_code: 'Press Allow in the Funscript app on the PC. The code is:', fun_waiting: 'Waiting for approval…',
            fun_denied: 'The TV was denied on the PC.', fun_expired: 'The request expired – try again.',
            fun_unreachable: 'Could not reach Funscript at {s}. Is "Control from phone" on, and is the app running?',
            fun_sessions: 'Sessions', fun_no_sessions: 'No saved sessions yet – build one in the Funscript app.',
            fun_no_clips: 'The session has no clips.', fun_forget: 'Forget connection', fun_clip: 'Clip {i}/{n}', fun_clips: 'clips',
            fun_hint: '◀ ▶ seek 10 sec · ▲ next clip · ▼ previous clip · OK pause · Back stop',
            handy_ready: 'Handy ready', handy_none: 'no Handy', handy_on: 'Handy', handy_error: 'Handy: {e}',
            handy_offline: 'Handy is not online – check that it is on WiFi', handy_bad_app: 'Invalid Application ID',
            handy_too_long: 'The session is too long for the Handy', handy_upload_failed: 'Uploading the script to the Handy failed', group: 'Group', group_channel: 'Channel', group_none: 'None', no_channels: 'No channels found (the videos have no studio/channel in Jellyfin).', update_available: 'TvFin {v} is available – run ./update.sh on the server'
        },
        de: {
            _name: 'Deutsch',
            loading: 'Wird geladen…', error_title: 'Etwas ist schiefgelaufen', retry: 'Erneut versuchen', error: 'Fehler: {e}',
            connect_title: 'Mit deinem Jellyfin-Server verbinden',
            connect_hint: 'IP-Adresse oder Hostname eingeben, z. B. 192.168.1.20 oder jellyfin.example.com',
            connect: 'Verbinden', connecting: 'Verbinde…', server_not_found: 'Kein Jellyfin-Server unter "{s}" gefunden',
            qc_title: 'Mit Quick Connect anmelden',
            qc_hint: 'Öffne Jellyfin auf Handy oder Computer → Profil → Quick Connect und gib den Code ein:',
            qc_disabled: 'Quick Connect ist auf dem Server deaktiviert. Aktiviere es unter Dashboard → Allgemein → "Quick Connect aktivieren".',
            qc_error: 'Code konnte nicht abgerufen werden: {e}', new_code: 'Neuer Code', change_server: 'Server wechseln', server: 'Server',
            logout: 'Abmelden', search: 'Suche', continue_watching: 'Weiterschauen', next_up: 'Als Nächstes',
            libraries: 'Bibliotheken', no_libraries: 'Keine Bibliotheken gefunden.', empty: 'Leer.',
            play: 'Abspielen', resume_from: 'Fortsetzen ab {t}', restart: 'Von vorne', mark_played: 'Als gesehen markieren',
            played: 'Gesehen', favorite: 'Favorit', ends_at: 'Endet um {t}', time_sep: ':',
            video: 'Video', audio: 'Audio', subtitles: 'Untertitel', studio: 'Studio', genre: 'Genre', director: 'Regie',
            scenes: 'Szenen', chapter: 'Kapitel {n}', runtime_hm: '{h} Std. {m} Min.', runtime_m: '{m} Min.',
            off: 'Aus', player_hint: '◀ ▶ 10 Sek. spulen · ▲ Audio & Untertitel · OK Pause · Zurück Stopp',
            start_error: 'Wiedergabe konnte nicht gestartet werden: {e}', play_error: 'Wiedergabefehler: {e}',
            no_source: 'Keine abspielbare Quelle', cannot_play: 'Der Server kann diese Datei nicht abspielen',
            up_next: 'Nächste Folge', starts_in: 'Startet in {n} Sek.', play_now: 'Jetzt abspielen', cancel: 'Abbrechen',
            search_placeholder: 'Filme, Serien, Videos suchen…', search_hint: 'OK drücken zum Tippen', no_results: 'Keine Ergebnisse',
            language: 'Sprache', unknown: 'Unbekannt',
            sort: 'Sortieren', sort_name: 'Name', sort_added: 'Hinzugefügt', sort_released: 'Erscheinungsdatum',
            sort_rating: 'Bewertung', sort_played: 'Zuletzt gesehen', sort_random: 'Zufällig',
            ascending: 'Aufsteigend', descending: 'Absteigend',
            view: 'Ansicht', view_auto: 'Automatisch', view_poster: 'Poster', view_posterCard: 'Posterkarten',
            view_thumb: 'Vorschaubilder', view_thumbCard: 'Vorschaukarten', view_banner: 'Banner', view_list: 'Liste',
            favorites: 'Favoriten', latest_in: 'Neu in {name}', whos_watching: 'Wer schaut?',
            add_user: 'Benutzer hinzufügen', sign_out_user: '{name} abmelden',
            skip_intro: 'Intro überspringen', skip_recap: 'Rückblick überspringen', skip_preview: 'Vorschau überspringen',
            skip_credits: 'Abspann überspringen', cast: 'Besetzung', more_like_this: 'Ähnliche Titel', back_hide: 'Zurück ausblenden', group: 'Gruppieren', group_channel: 'Kanal', group_none: 'Keine', no_channels: 'Keine Kanäle gefunden (die Videos haben kein Studio/keinen Kanal in Jellyfin).', update_available: 'TvFin {v} ist verfügbar – ./update.sh auf dem Server ausführen'
        },
        sv: {
            _name: 'Svenska',
            loading: 'Laddar…', error_title: 'Något gick fel', retry: 'Försök igen', error: 'Fel: {e}',
            connect_title: 'Anslut till din Jellyfin-server',
            connect_hint: 'Ange IP-adress eller värdnamn, t.ex. 192.168.1.20 eller jellyfin.example.com',
            connect: 'Anslut', connecting: 'Ansluter…', server_not_found: 'Hittade ingen Jellyfin-server på "{s}"',
            qc_title: 'Logga in med Quick Connect',
            qc_hint: 'Öppna Jellyfin på telefonen eller datorn → Profil → Quick Connect och ange koden:',
            qc_disabled: 'Quick Connect är avstängt på servern. Aktivera det under Kontrollpanel → Allmänt → "Aktivera Quick Connect".',
            qc_error: 'Kunde inte hämta kod: {e}', new_code: 'Ny kod', change_server: 'Byt server', server: 'Server',
            logout: 'Logga ut', search: 'Sök', continue_watching: 'Fortsätt titta', next_up: 'Nästa avsnitt',
            libraries: 'Bibliotek', no_libraries: 'Inga bibliotek hittades.', empty: 'Tomt.',
            play: 'Spela', resume_from: 'Fortsätt från {t}', restart: 'Börja om', mark_played: 'Markera som sedd',
            played: 'Sedd', favorite: 'Favorit', ends_at: 'Slutar {t}', time_sep: ':',
            video: 'Video', audio: 'Ljud', subtitles: 'Undertexter', studio: 'Studio', genre: 'Genre', director: 'Regi',
            scenes: 'Scener', chapter: 'Kapitel {n}', runtime_hm: '{h} tim {m} min', runtime_m: '{m} min',
            off: 'Av', player_hint: '◀ ▶ spola 10 s · ▲ ljud och undertexter · OK paus · Tillbaka stopp',
            start_error: 'Kunde inte starta uppspelning: {e}', play_error: 'Uppspelningsfel: {e}',
            no_source: 'Ingen spelbar källa', cannot_play: 'Servern kan inte spela upp den här filen',
            up_next: 'Nästa avsnitt', starts_in: 'Startar om {n} s', play_now: 'Spela nu', cancel: 'Avbryt',
            search_placeholder: 'Sök filmer, serier, videor…', search_hint: 'Tryck OK för att skriva', no_results: 'Inga resultat',
            language: 'Språk', unknown: 'Okänt',
            sort: 'Sortera', sort_name: 'Namn', sort_added: 'Datum tillagd', sort_released: 'Utgivningsdatum',
            sort_rating: 'Betyg', sort_played: 'Senast sedd', sort_random: 'Slumpvis',
            ascending: 'Stigande', descending: 'Fallande',
            view: 'Visning', view_auto: 'Automatisk', view_poster: 'Affischer', view_posterCard: 'Affischkort',
            view_thumb: 'Miniatyrer', view_thumbCard: 'Miniatyrkort', view_banner: 'Banderoller', view_list: 'Lista',
            favorites: 'Favoriter', latest_in: 'Senast tillagt i {name}', whos_watching: 'Vem tittar?',
            add_user: 'Lägg till användare', sign_out_user: 'Logga ut {name}',
            skip_intro: 'Hoppa över intro', skip_recap: 'Hoppa över sammanfattning', skip_preview: 'Hoppa över förhandstitt',
            skip_credits: 'Hoppa över eftertexter', cast: 'Medverkande', more_like_this: 'Mer som detta', back_hide: 'Tillbaka dölj', group: 'Gruppera', group_channel: 'Kanal', group_none: 'Ingen', no_channels: 'Inga kanaler hittades (videorna har ingen studio/kanal i Jellyfin).', update_available: 'TvFin {v} finns – kör ./update.sh på servern'
        },
        nb: {
            _name: 'Norsk',
            loading: 'Laster…', error_title: 'Noe gikk galt', retry: 'Prøv igjen', error: 'Feil: {e}',
            connect_title: 'Koble til Jellyfin-serveren din',
            connect_hint: 'Skriv inn IP-adresse eller vertsnavn, f.eks. 192.168.1.20 eller jellyfin.example.com',
            connect: 'Koble til', connecting: 'Kobler til…', server_not_found: 'Fant ingen Jellyfin-server på "{s}"',
            qc_title: 'Logg inn med Quick Connect',
            qc_hint: 'Åpne Jellyfin på telefonen eller datamaskinen → Profil → Quick Connect, og skriv inn koden:',
            qc_disabled: 'Quick Connect er slått av på serveren. Slå det på under Kontrollpanel → Generelt → "Aktiver Quick Connect".',
            qc_error: 'Kunne ikke hente kode: {e}', new_code: 'Ny kode', change_server: 'Bytt server', server: 'Server',
            logout: 'Logg ut', search: 'Søk', continue_watching: 'Fortsett å se', next_up: 'Neste episode',
            libraries: 'Biblioteker', no_libraries: 'Ingen biblioteker funnet.', empty: 'Tomt.',
            play: 'Spill av', resume_from: 'Fortsett fra {t}', restart: 'Start på nytt', mark_played: 'Merk som sett',
            played: 'Sett', favorite: 'Favoritt', ends_at: 'Slutter {t}', time_sep: ':',
            video: 'Video', audio: 'Lyd', subtitles: 'Undertekster', studio: 'Studio', genre: 'Sjanger', director: 'Regi',
            scenes: 'Scener', chapter: 'Kapittel {n}', runtime_hm: '{h} t {m} min', runtime_m: '{m} min',
            off: 'Av', player_hint: '◀ ▶ spol 10 sek · ▲ lyd og undertekster · OK pause · Tilbake stopp',
            start_error: 'Kunne ikke starte avspilling: {e}', play_error: 'Avspillingsfeil: {e}',
            no_source: 'Ingen spillbar kilde', cannot_play: 'Serveren kan ikke spille av denne filen',
            up_next: 'Neste episode', starts_in: 'Starter om {n} sek', play_now: 'Spill nå', cancel: 'Avbryt',
            search_placeholder: 'Søk etter filmer, serier, videoer…', search_hint: 'Trykk OK for å skrive', no_results: 'Ingen resultater',
            language: 'Språk', unknown: 'Ukjent',
            sort: 'Sorter', sort_name: 'Navn', sort_added: 'Dato lagt til', sort_released: 'Utgivelsesdato',
            sort_rating: 'Vurdering', sort_played: 'Sist sett', sort_random: 'Tilfeldig',
            ascending: 'Stigende', descending: 'Synkende',
            view: 'Visning', view_auto: 'Automatisk', view_poster: 'Plakater', view_posterCard: 'Plakatkort',
            view_thumb: 'Miniatyrbilder', view_thumbCard: 'Miniatyrkort', view_banner: 'Bannere', view_list: 'Liste',
            favorites: 'Favoritter', latest_in: 'Nylig lagt til i {name}', whos_watching: 'Hvem ser på?',
            add_user: 'Legg til bruker', sign_out_user: 'Logg ut {name}',
            skip_intro: 'Hopp over intro', skip_recap: 'Hopp over sammendrag', skip_preview: 'Hopp over forhåndsvisning',
            skip_credits: 'Hopp over rulletekst', cast: 'Medvirkende', more_like_this: 'Mer som dette', back_hide: 'Tilbake skjul', group: 'Grupper', group_channel: 'Kanal', group_none: 'Ingen', no_channels: 'Ingen kanaler funnet (videoene har ikke studio/kanal i Jellyfin).', update_available: 'TvFin {v} er klar – kjør ./update.sh på serveren'
        }
    };
    var order = ['da', 'en', 'de', 'sv', 'nb'];
    var KEY = 'tvfin-lang';

    function normalize(code) {
        code = String(code || '').toLowerCase().replace('_', '-');
        var base = code.split('-')[0];
        if (base === 'no' || base === 'nn') base = 'nb';
        return dict[base] ? base : null;
    }

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    var lang = normalize(saved) || normalize(navigator.language) || 'en';
    try { document.documentElement.lang = lang; } catch (e) { /* ignore */ }

    function t(key, args) {
        var s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
        if (args) for (var k in args) if (args.hasOwnProperty(k)) s = s.split('{' + k + '}').join(args[k]);
        return s;
    }

    function set(code) {
        lang = normalize(code) || lang;
        try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
    }

    function next() {
        set(order[(order.indexOf(lang) + 1) % order.length]);
        return lang;
    }

    // On the TV: use the TV's system language unless the user has picked one.
    function detectTv(cb) {
        if (saved || !window.tizen || !tizen.systeminfo) return;
        try {
            tizen.systeminfo.getPropertyValue('LOCALE', function (l) {
                var code = normalize(l.language);
                if (code && code !== lang) { lang = code; if (cb) cb(); }
            });
        } catch (e) { /* not available */ }
    }

    return {
        t: t, set: set, next: next, detectTv: detectTv,
        get lang() { return lang; },
        get name() { return dict[lang]._name; }
    };
})();
var t = I18n.t;
