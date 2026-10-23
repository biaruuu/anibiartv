import type { VideoTrack } from "@/components/ui/video-player"

export type Video = {
  id: string
  title: string
  description: string
  src: string
  poster?: string
  tracks: VideoTrack[]
}

const BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample"

// Sample caption files live in /public/captions. Replace them with real ones.
const sampleCaptions: VideoTrack[] = [
  { src: "/captions/en.vtt", srclang: "en", label: "English" },
  { src: "/captions/fil.vtt", srclang: "fil", label: "Filipino" },
]

const AGENT_327 = "https://files.vidstack.io/agent-327"

// Real subtitle files (dialogue) hosted by Vidstack for their Agent 327 demo.
const agentSubtitles: VideoTrack[] = [
  { id: "agent-en", srclang: "en", label: "English", src: `${AGENT_327}/subs/english.vtt` },
  { id: "agent-es", srclang: "es", label: "Spanish", src: `${AGENT_327}/subs/spanish.vtt` },
  { id: "agent-fr", srclang: "fr", label: "French", src: `${AGENT_327}/subs/french.vtt` },
  { id: "agent-de", srclang: "de", label: "German", src: `${AGENT_327}/subs/german.vtt` },
  { id: "agent-it", srclang: "it", label: "Italian", src: `${AGENT_327}/subs/italian.vtt` },
  { id: "agent-ru", srclang: "ru", label: "Russian", src: `${AGENT_327}/subs/russian.vtt` },
]

export const VIDEOS: Video[] = [
  {
    id: "agent-327",
    title: "Agent 327: Operation Barbershop",
    description:
      "A secret agent walks into a barbershop. Has real dialogue subtitles in six languages, so you can preview the caption style.",
    src: `${AGENT_327}/720p.mp4`,
    poster: `${AGENT_327}/poster.png`,
    tracks: agentSubtitles,
  },
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    description:
      "A giant rabbit takes on three bullying rodents. An open movie by the Blender Foundation.",
    src: `${BASE}/BigBuckBunny.mp4`,
    poster: `${BASE}/images/BigBuckBunny.jpg`,
    tracks: sampleCaptions,
  },
  {
    id: "sintel",
    title: "Sintel",
    description:
      "A young woman searches for the baby dragon she once befriended. A Blender Foundation open movie.",
    src: `${BASE}/Sintel.mp4`,
    poster: `${BASE}/images/Sintel.jpg`,
    tracks: sampleCaptions,
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    description:
      "A sci-fi short mixing live actors with visual effects, from the Blender Foundation.",
    src: `${BASE}/TearsOfSteel.mp4`,
    poster: `${BASE}/images/TearsOfSteel.jpg`,
    tracks: sampleCaptions,
  },
  {
    id: "elephants-dream",
    title: "Elephants Dream",
    description:
      "The first open movie by the Blender Foundation, set in a surreal mechanical world.",
    src: `${BASE}/ElephantsDream.mp4`,
    poster: `${BASE}/images/ElephantsDream.jpg`,
    tracks: sampleCaptions,
  },
  {
    id: "for-bigger-blazes",
    title: "For Bigger Blazes",
    description: "A short demo clip from Google's sample video collection.",
    src: `${BASE}/ForBiggerBlazes.mp4`,
    poster: `${BASE}/images/ForBiggerBlazes.jpg`,
    tracks: sampleCaptions,
  },
]
