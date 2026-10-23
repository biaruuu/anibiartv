# Changelog

## 1.4.0

### Changed
- Glass bubble redesign of the player controls, matching the reference photos: a frosted-glass pill at the top left (volume, cast) and top right (screenshot, download, captions, settings); glass circles for skip back 10, play/pause and skip forward 10 at 25%, 50% and 75%; a glass time pill (with the video title on wider players) and a glass fullscreen button above a thin progress bar.
- Sizes follow the proportions in the reference at both phone and fullscreen widths. The screenshot and download buttons are now always visible.
- The dim layer over the video is lighter, since the glass provides the contrast.
- The settings menu uses a stronger frosted-glass background.
- Captions sit higher while controls are visible so they never touch the new bottom row.

## 1.3.0

### Fixed
- The page was wider than the phone screen and the player was cut off on the left. The playlist's scroll area stretched the layout to the width of its longest text. The grid now has an explicit single column, the scroll area keeps its width, and the page clips any stray overflow.
- On short landscape screens the 16:9 player is capped to the screen height instead of running off the bottom.

### Changed
- The 10-second skip buttons now sit well to the left and right of the play button (Netflix style) instead of beside it.
- Captions are bolder and larger, with a per-line dark box, and the size scales with the player.
- Website icons now use Lucide; Vidstack icons are used only inside the video player.

### Added
- Caption style menu (Settings → Caption style): Small / Medium / Large, and a Dark box or Outline background. Remembered in the browser.
- "Autoplay next video" switch.
- shadcn Switch and Skeleton components; poster thumbnails show a skeleton while loading.

### Removed
- Previous and next buttons from the player controls.

## 1.2.0

### Removed
- The Dynamic Island pill. Quick feedback (screenshot saved, caption load errors) now uses a small plain notice, and double-tap or arrow-key seeking shows a seek icon.

### Changed
- Tapping or clicking the picture no longer pauses the video. It shows the controls, and tapping again hides them. Pause with the centre button or Space / K. Controls stay visible while paused and auto-hide after 3 seconds of playback.
- Touch screens no longer re-show the controls right after a tap hides them (emulated mouse events are ignored).
- The play button and every other control are smaller and now scale with the player's width instead of fixed pixel sizes.
- Captions scale with the player and use proportional padding.
- The time row shows the video title next to the duration on wider players.
- The player is always 16:9 (except in fullscreen, where it fills the screen) and works at every width.

### Added
- Add subtitles from a link in the Upload tab. Thumbnail preview tracks like `thumbnails.vtt` are detected and rejected with a clear message.
- Agent 327 sample video with real subtitles in English, Spanish, French, German, Italian and Russian, shown first in the playlist.

## 1.1.0

### Added
- Dynamic Island style pill at the top of the player. It rests as a small capsule and springs open for play/pause, seeking, volume, speed, captions, subtitle delay, loop, screenshot, download and "now playing" messages. Responsive: hidden on phones until something happens.
- Drag and drop videos and subtitle files onto the player.
- Subtitle delay control in the settings menu.
- New shadcn/ui components: Tabs, Alert, Label, ScrollArea, Kbd, Spinner.
- Upload tab with a drop zone, a list of added subtitles (with remove buttons) and a link field.

### Changed
- All icons are now Vidstack media-icons (MIT), inlined as SVG components. `lucide-react` is no longer a dependency.
- Restyled the page: soft background, Tabs for "Up next" and "Upload", info card under the player.
- The player no longer depends on the browser's `<track>` support. Captions use their own parser and are timed every frame.

### Fixed
- Adding subtitles failed for most files because the picker only accepted `.vtt`. SRT, VTT, ASS and SSA are now supported, including older text encodings.
- Opening a video file: the picker now lists MKV, MOV, AVI and others, accepts drag and drop, and shows a clear message when a file can't be played or read.
- Duration stayed at 0:00 if the video loaded before the page finished hydrating.
- Playback state could get out of sync when a new local file started playing immediately.

## 1.0.1

### Changed
- New player layout: volume and cast on the top left; screenshot, download, captions and settings on the top right.
- Large round play/pause button in the centre, with previous and next beside it for playlists.
- Time and fullscreen button now sit directly above a thin progress bar that also shows how much is buffered.
- The bottom button row (play/pause, volume, settings and so on) is gone.
- Settings is now a menu with Captions, Speed, Loop and Picture in picture.
- Switching videos no longer exits fullscreen.

### Added
- Fullscreen automatically rotates to landscape on supported devices (Android and other browsers with the Screen Orientation API). It unlocks again when you leave fullscreen.
- Screenshot button (saves the current frame as a PNG).
- Download button.
- Cast button (shown where the browser supports casting).

## 1.0.0

- Initial release: Next.js + shadcn/ui video player with Poppins captions, playlist, and play-your-own link or file.
