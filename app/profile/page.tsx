import { Suspense } from "react"

import { ProfileApp } from "@/components/profile-app"

export const metadata = { title: "Profile" }

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileApp />
    </Suspense>
  )
}
