# Videoplayer

A modern, responsive video player web app built with **Next.js**, **shadcn/ui** and **Tailwind CSS v4**. Flat design, no gradients. Captions render in **Poppins**, icons come from **Vidstack**, and a **Dynamic Island** style pill shows what is happening.

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

- **Dynamic Island.** A black capsule at the top centre rests with a mini equalizer and the video title, then springs open to show play/pause, seeking, volume, speed, captions, subtitle delay, screenshots and more. On phones it stays hidden until something happens.
- **Subtitles that work with real files.** Add `.srt`, `.vtt`, `.ass` or `.ssa` files (several at once if you like). The player parses them itself, so styling tags and ASS override codes are stripped cleanly. Older Windows-1252 files are detected automatically. Pick between tracks and adjust **Subtitle delay** in settings.
- **Open files from your device.** Use the buttons or just drag and drop a video and subtitles onto the player. Nothing is uploaded; files stay in your browser.
- **Stream from a link.** Paste a direct MP4 or WebM URL.
- Streaming-style layout: volume and cast on the top left; screenshot, download, captions and settings on the top right; big round play/pause in the centre; time and fullscreen above a thin progress bar with buffering.
- Fullscreen automatically rotates to landscape on supported devices (Android and other browsers with the Screen Orientation API). iPhone Safari uses its native player, which rotates on its own.
- Playlist with previous, next and auto-advance. Switching videos keeps you in fullscreen.
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
components/ui/               shadcn/ui components, video-player.tsx, dynamic-island.tsx
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

Icons are from [Vidstack media-icons](https://github.com/vidstack/media-icons), MIT licensed (see `licenses/vidstack-media-icons.txt`).
