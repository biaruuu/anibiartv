import { Suspense } from "react"

import { SearchApp } from "@/components/search-app"

export default function SearchPage() {
  return (
    <Suspense>
      <SearchApp />
    </Suspense>
  )
}
