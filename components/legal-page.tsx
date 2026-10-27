import * as React from "react"

import { SiteFooter, SiteHeader } from "@/components/site-header"

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || ""
export const UPDATED = "October 26, 2026"

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-[#000000] text-[#f2f3f5]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-24 pb-14 sm:px-8 sm:pt-28">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-white/50">Last updated: {UPDATED}</p>
        <div className="mt-8 space-y-8 text-[0.95rem] leading-relaxed text-white/75">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
      {children}
    </section>
  )
}

export function Contact() {
  return (
    <Section title="Contact">
      <p>
        Questions about this page or your data?{" "}
        {CONTACT_EMAIL ? (
          <>
            Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            .
          </>
        ) : (
          "Reach out to the site owner through the contact details on the AniBiar TV home page."
        )}
      </p>
    </Section>
  )
}
