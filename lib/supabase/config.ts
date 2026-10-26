// Both values are public by design (the publishable key only works within the row-level security rules).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zrlzsrakfzfayegvvisg.supabase.co"
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_PIaz0dn6UgqXTLwm80fBfw_hImeudBy"
