import { Suspense } from "react"

import { LibraryApp } from "@/components/library-app"

export const metadata = { title: "History & My List" }

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryApp />
    </Suspense>
  )
}
