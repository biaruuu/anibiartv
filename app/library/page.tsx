import { redirect } from "next/navigation"

// History and My List now live on the profile page.
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(`/profile?tab=${tab === "list" ? "list" : "history"}`)
}
