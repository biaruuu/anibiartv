# AniBiar

A modern, responsive video player web app built with **Next.js**, **shadcn/ui** and **Tailwind CSS v4**. Flat design, no gradients. Captions render in **Poppins**. The video player uses **Vidstack** icons; the rest of the website uses **Lucide** icons.

## Pages

- `/` anime home screen (AniList GraphQL: trending hero, latest episodes, search).
- `/watch` the video player. Streaming servers are not connected yet, so it plays demo videos.

## Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. Leave the defaults. Vercel detects Next.js automatically (build command `next build`).
3. Click **Deploy**.

Tip: run `npm install` once locally and commit the generated `package-lock.json` so deployments install the exact same versions every time.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node.js 20.9 or newer.

## Features

- **Tap to show or hide controls.** Tapping or clicking the picture only shows or hides the controls; it never pauses. Pause with the play/pause button or Space / K. Controls stay visible while paused and auto-hide after 3 seconds of playback.
- **Always 16:9 and fully responsive.** The player keeps a 16:9 frame at every size, and every control, caption and menu scales with the player's own width (CSS container queries), from a small phone to a fullscreen 4K screen.
- **Subtitles from a link.** Paste a link to an SRT, VTT or ASS file in the Upload tab. Thumbnail preview tracks (image sprite references) are detected and rejected with an explanation. The first playlist video, Agent 327, ships with real subtitles in six languages so you can preview the caption style.
- **Subtitles that work with real files.** Add `.srt`, `.vtt`, `.ass` or `.ssa` files (several at once if you like). The player parses them itself, so styling tags and ASS override codes are stripped cleanly. Older Windows-1252 files are detected automatically. Pick between tracks and adjust **Subtitle delay** in settings.
- **Open files from your device.** Use the buttons or just drag and drop a video and subtitles onto the player. Nothing is uploaded; files stay in your browser.
- **Stream from a link.** Paste a direct MP4 or WebM URL.
- **Volume boost.** Settings → Volume boost raises the sound to 150%, 200% or 300% through a Web Audio gain node with a soft limiter. It needs the video host to allow cross-origin reads; local files always work.
- **Glass bubble controls.** Frosted-glass pills at the top (volume and cast on the left; screenshot, download, captions and settings on the right), glass circles for skip back, play/pause and skip forward, a plain time/title label and a glass fullscreen button over a thin progress bar. Thin translucent fills with background blur, no gradients. The settings menu is a glass panel with glass capsule rows and a notch pointing at the settings button.
- Streaming-style layout: volume and cast on the top left; screenshot, download, captions and settings on the top right; big round play/pause in the centre with the 10-second skip buttons well to either side (Netflix style); time and fullscreen above a thin progress bar with buffering.
- Fullscreen automatically rotates to landscape on supported devices (Android and other browsers with the Screen Orientation API). iPhone Safari uses its native player, which rotates on its own.
- **Readable captions.** Bold Poppins that scales with the player, in a dark box or a heavy outline, in three sizes (Settings → Caption style). Defaults are Small with Outline. Your choice is remembered.
- Playlist with auto-advance (turn it off with the Autoplay switch). Switching videos keeps you in fullscreen.
- Settings menu: Captions, Subtitle delay, Speed (0.5x to 2x), Loop, Picture in picture.
- Light and dark themes, installable web app manifest.
- shadcn/ui components: `Button`, `Slider`, `Tooltip`, `Card`, `Tabs`, `Alert`, `Input`, `Label`, `Badge`, `Separator`, `ScrollArea`, `Kbd`.

## Subtitle formats

| Format | Notes |
| --- | --- |
| SRT | Plain `.srt` files, with `<i>`/`<b>` tags removed |
| WebVTT | Cue settings and styling tags are ignored |
| ASS / SSA | Dialogue lines are read; override codes like `{\an8}` and vector drawings are skipped |

If a video won't play, the file format is usually the cause. MP4 (H.264 + AAC) and WebM work in every browser; MKV and AVI depend on the browser and device.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space / K | Play or pause |
| ← / → (or J / L) | Seek 10 seconds |
| ↑ / ↓ | Volume |
| M | Mute |
| F | Fullscreen |
| C | Captions |
| Esc | Close the settings menu |

## Project structure

```
app/                         Next.js app router (layout, page, manifest, global styles)
components/player-app.tsx    The page: player, playlist, upload tab
components/ui/               shadcn/ui components and video-player.tsx
components/icons/vidstack.tsx  Vidstack icons as React components
lib/captions.ts              SRT / VTT / ASS parser
lib/videos.ts                Sample playlist
public/captions/             Sample .vtt caption files
licenses/                    Third-party licenses
```

## Customising

Edit `lib/videos.ts` to change the playlist and replace the files in `public/captions/` with your own subtitles. Sample videos are open Blender Foundation movies hosted in Google's public sample bucket.

To add more shadcn/ui components later: `npx shadcn@latest add <component>` (the project already includes `components.json`).

## Credits

Player icons are from [Vidstack media-icons](https://github.com/vidstack/media-icons), MIT licensed (see `licenses/vidstack-media-icons.txt`). Website icons are from [Lucide](https://lucide.dev) (ISC).
