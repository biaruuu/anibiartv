import { notFound } from "next/navigation"

import { InfoApp } from "@/components/info-app"

export default async function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) notFound()
  return <InfoApp id={n} />
}
