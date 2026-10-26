import { Contact, LegalPage, Section } from "@/components/legal-page"

export const metadata = {
  title: "Privacy Policy",
  description: "How AniBiar TV collects, uses and protects your information.",
}

const ul = "list-disc space-y-1.5 pl-5 marker:text-white/40"

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        AniBiar TV (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a website for discovering and watching anime. This policy explains what
        information we collect when you use the site, how we use it, and the choices you have. By using AniBiar TV you agree to
        this policy.
      </p>

      <Section title="Information we collect">
        <p>You can browse the site without an account. If you create one, we collect:</p>
        <ul className={ul}>
          <li>
            <strong className="text-white">Account details:</strong> your email address and, if you sign in with Google or Discord,
            your public profile name and profile picture as shared by that service. If you sign up with email and password, your
            password is stored only as a secure hash. We never see or store it in readable form.
          </li>
          <li>
            <strong className="text-white">Your activity:</strong> the anime and episodes you watch, how far you got (for Continue
            Watching), the audio you chose (sub or dub), and the titles you add to My List.
          </li>
          <li>
            <strong className="text-white">Settings on your device:</strong> player preferences (autoplay, auto next, captions,
            volume boost), recent searches, and the same watch history and list kept in your browser&apos;s local storage so the
            site works when you are signed out.
          </li>
          <li>
            <strong className="text-white">Technical data:</strong> like most sites, our hosting provider processes your IP
            address, browser type and requests to deliver pages and keep the service secure.
          </li>
        </ul>
        <p>We do not ask for payment details, and we do not sell your personal information.</p>
      </Section>

      <Section title="How we use it">
        <ul className={ul}>
          <li>To create and secure your account and let you sign in.</li>
          <li>To save your Continue Watching progress and My List and sync them across your devices.</li>
          <li>To run, protect and improve the site, and to fix errors.</li>
        </ul>
      </Section>

      <Section title="Sign in with Google and Discord">
        <p>
          If you choose Google or Discord, we receive only your basic profile (name, email address and picture) to create your
          account. We do not read your Google or Discord messages, contacts, files or servers. AniBiar TV&apos;s use of information
          received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-white underline underline-offset-2"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </Section>

      <Section title="Services we rely on">
        <p>Your information is handled by these providers only as needed to run the site:</p>
        <ul className={ul}>
          <li>
            <strong className="text-white">Supabase</strong>: account sign-in and the database that stores your watch history and
            list.
          </li>
          <li>
            <strong className="text-white">Vercel</strong>: website hosting.
          </li>
          <li>
            <strong className="text-white">Upstash</strong>: temporary caching of public anime data (not personal data).
          </li>
          <li>
            <strong className="text-white">AniList and TMDB</strong>: public anime information and artwork. Your searches are sent to
            them to return results.
          </li>
          <li>
            <strong className="text-white">Google and Discord</strong>: only if you choose to sign in with them.
          </li>
        </ul>
        <p>
          Videos are provided by third-party servers and are not stored by AniBiar TV. Those servers may see your IP address when
          you play a video.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We use cookies and local storage that are necessary for the site to work: to keep you signed in, and to remember your
          player settings, recent searches and watch progress. We do not use advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section title="How long we keep data">
        <p>
          Account data, watch history and My List are kept until you delete them or ask us to delete your account. You can remove
          any item from Continue Watching, History or My List at any time. You can clear local data by clearing your browser&apos;s
          site data.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <ul className={ul}>
          <li>Access, correct or delete your information, or delete your whole account, by contacting us.</li>
          <li>Log out at any time from the site menu.</li>
          <li>Withdraw access for Google or Discord from that service&apos;s account settings.</li>
        </ul>
        <p>Depending on where you live, you may have additional rights under local data-protection law. Contact us to use them.</p>
      </Section>

      <Section title="Security">
        <p>
          Data is sent over HTTPS and your watch history and list are protected so that only you can read and change them. No online
          service is perfectly secure, so please use a strong, unique password.
        </p>
      </Section>

      <Section title="Children">
        <p>
          AniBiar TV is not directed to children under 13, and we do not knowingly collect their personal information. If you believe
          a child has given us information, contact us and we will delete it.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. The date at the top shows the latest version. Continuing to use the site after
          a change means you accept it.
        </p>
      </Section>

      <Contact />
    </LegalPage>
  )
}
