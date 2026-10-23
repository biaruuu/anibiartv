import { VideoPlayer } from "@/components/ui/video-player"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center gap-6 p-4 sm:p-8">
      <VideoPlayer
        title="Big Buck Bunny"
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        poster="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
        tracks={[
          { src: "/captions/en.vtt", srclang: "en", label: "English" },
          { src: "/captions/fil.vtt", srclang: "fil", label: "Filipino" },
        ]}
      />
      <p className="text-muted-foreground text-center text-sm">
        Shortcuts: Space/K play · ←/→ seek 10s · ↑/↓ volume · M mute · F fullscreen · C captions
      </p>
    </main>
  )
}
