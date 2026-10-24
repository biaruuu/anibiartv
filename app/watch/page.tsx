import { Suspense } from "react"

import { PlayerApp } from "@/components/player-app"

export default function WatchPage() {
  return (
    <Suspense>
      <PlayerApp />
    </Suspense>
  )
}
