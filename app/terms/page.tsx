import Link from "next/link"

import { Contact, LegalPage, Section } from "@/components/legal-page"

export const metadata = {
  title: "Terms of Service",
  description: "The rules for using AniBiar TV.",
}

const ul = "list-disc space-y-1.5 pl-5 marker:text-white/40"

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Welcome to AniBiar TV. By accessing or using the site you agree to these terms. If you do not agree, please do not use the
        site.
      </p>

      <Section title="The service">
        <p>
          AniBiar TV lets you discover anime, play episodes in our video player, and (with an account) keep a watch history and a
          personal list. The service is provided free, as is, and may change or be unavailable at any time.
        </p>
      </Section>

      <Section title="Your account">
        <ul className={ul}>
          <li>You can sign up with email and password, Google or Discord.</li>
          <li>Give accurate information and keep your login details private. You are responsible for activity on your account.</li>
          <li>You must be at least 13 years old to create an account.</li>
          <li>We may suspend or remove accounts that break these terms or abuse the service.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className={ul}>
          <li>break the law or infringe anyone&apos;s rights while using the site;</li>
          <li>attack, overload, scrape at scale, or try to break into the site, its accounts or its servers;</li>
          <li>use bots or automated tools to create accounts or access the service in a way that harms others;</li>
          <li>copy, resell or redistribute the site&apos;s design or code without permission.</li>
        </ul>
      </Section>

      <Section title="Content and copyright">
        <p>
          AniBiar TV does not host or upload video files. Video streams are provided by third-party servers, and anime information
          and artwork come from services such as AniList and TMDB. All anime titles, images and related marks belong to their
          respective owners.
        </p>
        <p>
          If you are a rights holder and believe something linked or shown on the site infringes your rights, contact us with the
          details and the page address, and we will review it and act where appropriate.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          The site relies on third-party services (including Supabase, Vercel, Google and Discord). Their own terms apply when you
          use them, and we are not responsible for their availability or content.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind. We do not
          promise that it will be uninterrupted, error-free, or that every episode or server will always work.
        </p>
      </Section>

      <Section title="Limit of liability">
        <p>
          To the fullest extent allowed by law, AniBiar TV and its owner are not liable for any indirect or consequential loss, or
          for loss of data or profits, arising from your use of the site.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          How we handle your information is explained in our{" "}
          <Link href="/privacy" className="text-white underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms. The date at the top shows the latest version, and continuing to use the site after a change
          means you accept it.
        </p>
      </Section>

      <Contact />
    </LegalPage>
  )
}
