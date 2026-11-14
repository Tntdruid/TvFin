/* Oversættelser. Sproget følger TV'et/browseren, men kan skiftes på forsiden. */
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
            ascending: 'Stigende', descending: 'Faldende'
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
            ascending: 'Ascending', descending: 'Descending'
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
            ascending: 'Aufsteigend', descending: 'Absteigend'
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
            ascending: 'Stigande', descending: 'Fallande'
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
            ascending: 'Stigende', descending: 'Synkende'
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
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignorer */ }
    var lang = normalize(saved) || normalize(navigator.language) || 'en';

    function t(key, args) {
        var s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
        if (args) for (var k in args) if (args.hasOwnProperty(k)) s = s.split('{' + k + '}').join(args[k]);
        return s;
    }

    function set(code) {
        lang = normalize(code) || lang;
        try { localStorage.setItem(KEY, lang); } catch (e) { /* ignorer */ }
    }

    function next() {
        set(order[(order.indexOf(lang) + 1) % order.length]);
        return lang;
    }

    // På TV'et: brug TV'ets systemsprog, hvis brugeren ikke selv har valgt.
    function detectTv(cb) {
        if (saved || !window.tizen || !tizen.systeminfo) return;
        try {
            tizen.systeminfo.getPropertyValue('LOCALE', function (l) {
                var code = normalize(l.language);
                if (code && code !== lang) { lang = code; if (cb) cb(); }
            });
        } catch (e) { /* ikke tilgængelig */ }
    }

    return {
        t: t, set: set, next: next, detectTv: detectTv,
        get lang() { return lang; },
        get name() { return dict[lang]._name; }
    };
})();
var t = I18n.t;
