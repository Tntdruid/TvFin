**English** | [Dansk](CHANGELOG.da.md)

# Changelog

All changes to TvFin. Update the TV by running `./update.sh` on the server.

## 1.4.0 – 2026-11-14

### Added
- **More rows on the home screen:** *Favorites* and *Latest in …* for each library (new episodes are grouped per series, like in Jellyfin).
- **Several users on one TV:** the user button on the home screen opens *Who's watching?*, where you can switch user, add a new one with Quick Connect, or sign out just one of them. With more than one saved user, the app asks who's watching at startup.
  - Each user gets their own device ID, so Jellyfin keeps their sessions and watch progress apart.
  - Existing sign-ins are kept when updating.

## 1.3.1 – 2026-11-14

### Fixed
- Subtitles are hidden while the audio/subtitle menu is open, so they no longer show through it.

### Docs
- Screenshots in the README.
- Links to the other Jellyfin projects.

## 1.3.0 – 2026-11-14

### Added
- **View modes in folders** (like Jellyfin web): the *▦ View* button cycles through
  *Automatic*, *Posters*, *Poster cards*, *Thumbs*, *Thumb cards*, *Banners* and *List*.
  The choice is remembered per folder – including inside series and seasons.
  - *List* shows a small image with title, year, runtime, rating and a short overview.
  - *Banners* uses Jellyfin's banner images and falls back to thumb/backdrop.

### Fixed
- The language button on the server and sign-in screens is now on its own line, so pressing down from the input goes to *Connect*.

## 1.2.1 – 2026-11-14

### Fixed
- **Bigger thumbnails:** cards are now 560 px wide (was 420), posters 300 px (was 240), with larger text and sharper images.
- If the TV reports a screen wider than 1920 px (e.g. 4K), the whole app is scaled up so nothing looks tiny.

## 1.2.0 – 2026-11-14

### Added
- **UI languages:** Danish, English, German, Swedish and Norwegian. Follows the TV's language automatically and can be switched with the 🌐 button on the home screen.
- **Audio and subtitles:** press **▲** during playback to choose audio track and subtitles. Your language choice is remembered.
  - Text subtitles (SRT, ASS, VTT …) are rendered by the app, so no transcoding is needed.
  - Image subtitles (PGS/DVD) are burned in by the server.
- **Auto-play next episode:** when an episode ends, "Next episode – starts in 10 sec" is shown with *Play now* and *Cancel*.
- **Search:** 🔍 button on the home screen; searches movies, series, episodes and videos.
- **Sorting in folders:** name, date added, release date, rating, last played or random, ascending or descending. Remembered per folder.

### Fixed
- Left/right navigation could skip buttons placed close together.
- Pressing down from an input now goes to the left-most element instead of an arbitrary one.

## 1.1.0 – 2026-11-14

### Added
- **Info page** when selecting a video: image, year, runtime, "ends at", video and audio info, overview, studio and genre.
- Buttons for **Play / Resume**, **Start over**, **Mark as played** and **Favorite**.
- **Scenes:** chapter images; pick a chapter to start from there.

## 1.0.1 – 2026-11-14

### Fixed
- Thumbnails were not shown when the server didn't send image tags. The app now tries several image types in turn.

## 1.0.0 – 2026-11-14

First release.
- Sign in with **Quick Connect**.
- Home screen with *Continue watching*, *Next up* and libraries.
- Playback with Samsung's AVPlay (direct play or HLS transcoding from the server).
- **Remembers where you left off:** the position is stored on the Jellyfin server.
- Install via Docker (same container as georift/install-jellyfin-tizen) and `update.sh` from GitHub.
