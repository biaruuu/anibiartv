# Changelog

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
