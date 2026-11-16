# Noter til Claude

TvFin er brugerens egen, minimale Jellyfin-app til Samsung-tv (Tizen). Ren HTML/CSS/JS uden build-trin og uden
pakker: alt ligger i `app/` og installeres direkte på tv'et.

## Struktur

- `app/index.html`, `app/css/style.css`, `app/config.xml` (Tizen-widget, **version** står her).
- `app/js/api.js` – Jellyfin-klient (`Api`), login via Quick Connect, brugere, `VERSION`-konstanten (skal matche
  `config.xml`) og tjek af nyeste version på GitHub ("ny version"-besked på forsiden).
- `app/js/app.js` – skærme (`Screens.home`, `detail`, `person`, `funpair`, `funscript` …), `go()`/`stack`, `App.toast`.
- `app/js/player.js` – afspilleren (`Player`, `Player.makeBackend()` = AVPlay på tv'et, `<video>` i browseren).
- `app/js/nav.js` – fokus/piletaster for fjernbetjeningen (`.focusable`, `data-action`, `data-key`).
- `app/js/i18n.js` – `t(key, args)`; sprog **da, en, de, sv, nb**, med `en` som fallback. Nye tekster skal mindst
  have `da` og `en`.
- `app/js/funscript.js` – Funscript Session på tv'et (se nedenfor).

## Regler for koden

- **Ældre Tizen-tv:** ingen `?.` og ingen `??`, ingen nye browser-API'er uden fallback. Kommentarer står allerede
  øverst i filerne. `async/await` og `Promise` bruges allerede og er ok.
- Gem pr. bruger i `localStorage` (nøgler med `tvfin`-præfiks), ikke globalt.
- Fejl vises med `App.toast(t('…'))`, ikke `alert()`.

## Test

Der er ingen testsuite. Tjek altid:
- `node --check app/js/<fil>.js` for de filer, der er rørt.
- I browseren: `node scripts/serve.js` → http://localhost:8080 (launch-konfigurationen hedder `tvfin`). Uden
  `window.tizen` bruger afspilleren `<video>` i stedet for AVPlay, så tv-specifikke ting (AVPlay, fjernbetjenings-
  taster som 10009/413/415) kan ikke testes fuldt i browseren – sig det, når noget ikke er prøvet på tv'et.

## Udgivelse ("push" i dette repo)

Følger brugerens globale regel: tests (her: syntaks-tjek ovenfor), så version + changelog, commit, tag, push og
GitHub-release:
1. Hæv versionen ens i `app/config.xml` (`version="X.Y.Z"`) og `app/js/api.js` (`var VERSION = 'X.Y.Z'`).
   Ny funktion = minor, rettelse = patch.
2. Tilføj et afsnit øverst i **både** `CHANGELOG.md` og `CHANGELOG.da.md` (`## X.Y.Z – ÅÅÅÅ-MM-DD`, `### Added/Tilføjet`
   osv.). Opdater `README.md`/`README.da.md` hvis en funktion skal nævnes i listen.
3. Commit-besked: `vX.Y.Z: kort beskrivelse` (se `git log`), tag `vX.Y.Z`, push (også tagget) og lav GitHub-release
   med changelog-afsnittet. Første tag/release var v1.9.0. Tv'ets "ny version"-besked læser `app/config.xml` på `main`
   (raw.githubusercontent), så versionen i `config.xml` er det, der tæller for tv'et.
4. Brugeren opdaterer tv'et med `./update.sh` på sin Linux-server (Docker; tv'ets IP gemmes i `.tv-ip`).

Commit eller push kun, når brugeren beder om det.

## Funscript-integration

Spiller sessioner fra **Funscript Session** (`D:\OneDrive\Code Stuff\Funscript`, se dens `CLAUDE.md`) via dens
LAN-server på port 8001.
- `Fun.discover`: finder Funscript selv ved at spørge `GET /tv/hello` på port 8001 for alle adresser i de lokale
  /24-net (tv'ets IP via `webapis.network.getIp()` – kræver privilegiet `network.public` i `config.xml` –,
  Jellyfin-serverens adresse og en tidligere Funscript-adresse). Parringsskærmen søger automatisk og viser fundne PC'er.
- `Fun`: parring (`POST /tv/pair`, `GET /tv/pair/<id>`), nøglen gemmes pr. TvFin-bruger i `localStorage`
  `tvfin-funscript` sammen med adressen og evt. Handy-opsætning. Læser `/tv/sessions`, `/tv/sessions/<id>`,
  `/tv/media/<id>` (Range), `/tv/thumb/<id>`.
- Melder tilbage: `Fun.played` (første gang en session starter), `Fun.tick` (spilletid hvert 30. sek mens der spilles),
  `Fun.saveResume` (position hvert 10. sek, ved pause og stop; ryddes når sessionen er færdig). Positionen deles med
  PC'en, så "Fortsæt" virker begge veje. `Fun.resume` giver knappen "▶ Fortsæt «navn» fra …" på Funscript-skærmen.
- `Handy`: port af Funscripts `web/handy.js` (API v3, HSSP), ES5-venlig.
- `FunPlayer.start(cfg, id, exit, startMs)`: afspiller klip efter klip; sessionstid = `clip.offsetMs + (videoTid -
  clip.startMs)`; Handy stoppes ved klipskift og startes igen ved `started`; drift-korrektion hvert 5. sek (> 300 ms).
- Ændringer her kræver ofte en matchende ændring i Funscripts `remote.py` (og omvendt).

**Idéer, ikke lavet:** vibratorer via Intiface fra tv'et, tempo (playback_rate), edge-spil og stemme-coach på tv'et.
