[English](README.md) | **Dansk**

# TvFin – minimal Jellyfin-afspiller til Samsung TV (Tizen)

- **Quick Connect**-login (ingen tastatur nødvendigt)
- **Fortsæt med at se** / **Næste afsnit** / biblioteker
- Afspiller med Samsungs AVPlay (direkte afspilning af mkv/mp4/HEVC m.m., ellers omkoder serveren til HLS)
- Infoside med kapitler, lyd/undertekst-valg, automatisk næste afsnit, søgning, sortering, visninger og 5 sprog – se [CHANGELOG.da.md](CHANGELOG.da.md)
- **Husker hvor du er nået til** – positionen gemmes på Jellyfin-serveren (hvert 10. sek, ved pause, spol og stop), så den også passer med telefonen osv.

## Skærmbilleder

![Forside](docs/screenshots/home.png)

| | |
|---|---|
| ![Infoside](docs/screenshots/detail.png) | ![Kapitler](docs/screenshots/chapters.png) |
| ![Afspiller med undertekster](docs/screenshots/player.png) | ![Menu til lyd og undertekster](docs/screenshots/tracks.png) |
| ![Bibliotek (plakater)](docs/screenshots/library.png) | ![Listevisning](docs/screenshots/list.png) |
| ![Søgning](docs/screenshots/search.png) | ![Login med Quick Connect](docs/screenshots/login.png) |

_Demo-indhold med opdigtede titler og genereret grafik._

## Installation fra en Linux-server (via GitHub)

Serveren skal have Docker og git, og dens IP skal stå som Developer-IP på TV'et.

```bash
git clone https://github.com/Tntdruid/TvFin.git
cd TvFin
./update.sh 192.168.1.50      # TV'ets IP – huskes til næste gang
```

Opdater senere med bare `./update.sh` (henter nyeste kode fra GitHub og geninstallerer).

## Installation på TV'et fra Windows

Kræver **Docker Desktop** på PC'en. Det bruger samme container som
[georift/install-jellyfin-tizen](https://github.com/Georift/install-jellyfin-tizen), bare med vores egen app.

1. **Developer Mode på TV'et:** Apps → tast `12345` (tryk "123" eller hold Home nede for tastatur) →
   slå *Developer mode* til → indtast PC'ens IP-adresse → genstart TV'et.
2. Find TV'ets IP (Indstillinger → Generelt → Netværk → Netværksstatus → IP-indstillinger).
3. Kør i denne mappe:

```powershell
.\install.ps1 192.168.1.50
```

(macOS/Linux: `./install.sh 192.168.1.50`)

Første gang trækkes Docker-imaget (~1–2 GB). Den færdige pakke lægges også i `dist/TvFin.wgt`.
Opdatering = kør scriptet igen.

## Fjernbetjening

| Tast | Menu | Afspiller |
|---|---|---|
| Pile | Flyt fokus | ◀ ▶ spol 10 sek, ▲ lyd og undertekster |
| OK | Vælg | Pause/afspil |
| Tilbage | Tilbage / afslut | Stop (gemmer position) |
| ⏪ ⏩ | | Spol 30 sek |

## Test i browser

```powershell
node scripts/serve.js
```

Åbn http://localhost:8080 – piletaster, Enter og Backspace/Esc virker som fjernbetjeningen.

## Filer

- `app/` – selve Tizen-appen (`config.xml`, `index.html`, `js/`, `css/`)
- `app/js/i18n.js` – oversættelser (da, en, de, sv, nb)
- `scripts/tizen-install.sh` – kører i containeren: pakker og installerer
- `scripts/make-icon.js` – genererer `app/icon.png`

<!-- jellyfin-projects:start -->
## More Jellyfin projects / Flere Jellyfin-projekter

| | 🇬🇧 | 🇩🇰 |
|---|---|---|
| [Jellyfin Music Stats](https://github.com/Tntdruid/jellyfin-music-stats) | Home Assistant add-on with music listening stats: top lists, genres, moods, Wrapped | Home Assistant-add-on med lyttestatistik for musik: top-lister, genrer, humør, Wrapped |
| [Jellyfin Video Stats](https://github.com/Tntdruid/jellyfin-video-stats) | Home Assistant add-on with viewing stats for movies, series and YouTube videos: progress, binges, transcoding, Wrapped | Home Assistant-add-on med seerstatistik for film, serier og YouTube-videoer: fremdrift, binge, transcoding, Wrapped |
| [Auto Artist Playlists](https://github.com/Tntdruid/jellyfin-plugin-auto-artist-playlists) | Jellyfin plugin that hearts the songs you listen to and adds them to a playlist per artist | Jellyfin-plugin, der giver hjerte til de sange, du hører, og samler dem i en playliste pr. kunstner |
| [Episode Title Fixer](https://github.com/Tntdruid/jellyfin-plugin-episode-title-fixer) | Jellyfin plugin that replaces placeholder episode titles like "Episode 11" with the original title | Jellyfin-plugin, der erstatter pladsholdere som "Afsnit 11" med afsnittets originale titel |
| [Tonefin](https://github.com/Tntdruid/tonefin) | Windows music player for Jellyfin that always reports what you play, so stats and plugins see every listen | Musikafspiller til Windows til Jellyfin, der altid rapporterer, hvad du spiller, så statistik og plugins ser hver lytning |
<!-- jellyfin-projects:end -->
