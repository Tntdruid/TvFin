**English** | [Dansk](README.da.md)

# TvFin – a minimal Jellyfin player for Samsung TVs (Tizen)

- **Quick Connect** sign-in (no typing a password on the remote)
- **Continue watching** / **Next up** / libraries
- Playback through Samsung's AVPlay (direct play of mkv/mp4/HEVC etc., otherwise the server transcodes to HLS)
- Info page with chapters, audio/subtitle selection, auto-play next episode, search, sorting, view modes and 5 UI languages – see [CHANGELOG.md](CHANGELOG.md)
- **Remembers where you left off** – the position is stored on the Jellyfin server (every 10 s, and on pause, seek and stop), so it stays in sync with your phone and other clients.

## Install from a Linux server (via GitHub)

The server needs Docker and git, and its IP must be set as the Developer IP on the TV.

```bash
git clone https://github.com/Tntdruid/TvFin.git
cd TvFin
./update.sh 192.168.1.50      # the TV's IP – remembered for next time
```

Update later with just `./update.sh` (pulls the latest code from GitHub and reinstalls).

## Install from Windows

Requires **Docker Desktop** on the PC. It uses the same container as
[georift/install-jellyfin-tizen](https://github.com/Georift/install-jellyfin-tizen), just with this app.

1. **Developer Mode on the TV:** Apps → type `12345` (press "123" or hold Home for the keypad) →
   turn *Developer mode* on → enter the PC's IP address → restart the TV.
2. Find the TV's IP (Settings → General → Network → Network Status → IP Settings).
3. Run in this folder:

```powershell
.\install.ps1 192.168.1.50
```

(macOS/Linux: `./install.sh 192.168.1.50`)

The first run pulls the Docker image (~1–2 GB). The packaged app is also written to `dist/TvFin.wgt`.
To update, run the script again.

## Remote control

| Key | Menus | Player |
|---|---|---|
| Arrows | Move focus | ◀ ▶ seek 10 s, ▲ audio & subtitles |
| OK | Select | Pause/play |
| Back | Back / exit | Stop (saves position) |
| ⏪ ⏩ | | Seek 30 s |

## Testing in a browser

```powershell
node scripts/serve.js
```

Open http://localhost:8080 – arrow keys, Enter and Backspace/Esc work like the remote.

## Files

- `app/` – the Tizen app itself (`config.xml`, `index.html`, `js/`, `css/`)
- `app/js/i18n.js` – UI translations (da, en, de, sv, nb)
- `scripts/tizen-install.sh` – runs inside the container: packages and installs
- `scripts/make-icon.js` – generates `app/icon.png`

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
