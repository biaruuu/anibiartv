# shadcn/ui Video Player

A responsive, smooth video player built on shadcn/ui components with lucide icons and Poppins captions.

## Setup

In an existing Next.js + Tailwind project:

```bash
npx shadcn@latest add button slider tooltip
npm install lucide-react
```

Then copy these into your project:

| File | Purpose |
| --- | --- |
| `components/ui/video-player.tsx` | The player component |
| `app/layout.tsx` (Poppins part) | Loads Poppins and exposes `--font-poppins` |
| `public/captions/*.vtt` | Your caption files |

If you are not using Next.js, load Poppins any way you like (Google Fonts `<link>` works). The component falls back to the family name `Poppins` automatically.

## Usage

```tsx
<VideoPlayer
  title="My Video"
  src="/videos/demo.mp4"
  poster="/videos/poster.jpg"
  tracks={[
    { src: "/captions/en.vtt", srclang: "en", label: "English" },
    { src: "/captions/fil.vtt", srclang: "fil", label: "Filipino" },
  ]}
/>
```

## Features

- shadcn `Button`, `Slider`, `Tooltip` for all controls
- lucide icons: Play, Pause, Rewind/Forward 10s, Volume (3 states), Captions, Settings, Picture-in-Picture, Fullscreen
- Captions drawn by a custom overlay in **Poppins** (the browser's native caption styling is disabled)
- Multiple caption languages, playback speed 0.5x–2x
- Auto-hiding controls with fade/slide animation; captions glide down when controls hide
- Responsive: icon sizes shrink on mobile, volume slider and PiP hide on small screens, text scales up in larger layouts
- Keyboard: Space/K, ←/→ (or J/L), ↑/↓, M, F, C. Double-click video for fullscreen

## Notes

- Captions need the video and `.vtt` files to be same-origin or served with CORS headers (the `<video>` uses `crossOrigin="anonymous"`).
- The shadcn Slider markup uses `data-slot` attributes (current shadcn versions). If you are on an older version, adjust the `[&_[data-slot=...]]` selectors in the className to match your `slider.tsx`.
