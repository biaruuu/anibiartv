import { Suspense } from "react"
import { notFound } from "next/navigation"

import { WatchApp } from "@/components/watch-app"

export default async function WatchAnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) notFound()
  return (
    <Suspense>
      <WatchApp key={n} id={n} />
    </Suspense>
  )
}
