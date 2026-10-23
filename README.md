# Videoplayer

A modern, responsive video player web app built with **Next.js**, **shadcn/ui**, **Tailwind CSS v4** and **lucide** icons. Flat design, no gradients. Captions are rendered in **Poppins**.

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

- shadcn/ui `Button`, `Slider`, `Tooltip`, `Card`, `Input`, `Badge`, `Separator`
- Floating, flat control panel (no gradients) with smooth fade and slide animations
- lucide icons for every control
- Captions drawn by a custom overlay in **Poppins**, with multiple languages and on/off toggle
- Playlist with previous, next and auto-advance
- Play your own video from a direct link or from a file on your device (files never leave your browser), and attach your own `.vtt` captions
- Playback speed 0.5x to 2x, picture-in-picture, fullscreen (with an iOS fallback)
- Double-tap or double-click the left or right side to seek 10 seconds, the centre for fullscreen
- Light and dark themes
- Installable web app manifest

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space / K | Play or pause |
| ← / → (or J / L) | Seek 10 seconds |
| ↑ / ↓ | Volume |
| M | Mute |
| F | Fullscreen |
| C | Captions |

## Project structure

```
app/                     Next.js app router (layout, page, manifest, global styles)
components/player-app.tsx  The page: player, playlist, "play your own"
components/ui/           shadcn/ui components and video-player.tsx
lib/videos.ts            Sample playlist
public/captions/         Sample .vtt caption files
```

## Using your own videos and captions

Edit `lib/videos.ts` to change the playlist, and replace the files in `public/captions/` with your own WebVTT files. Sample videos are hosted by Google's public sample bucket and are open Blender Foundation movies.

To add more shadcn/ui components later: `npx shadcn@latest add <component>` (the project already includes `components.json`).
