// Terms of use, privacy policy and community rules, in plain English (UK GDPR).
// Company details come from brand.json `company`; fill them in before launch.
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PageTop } from '../components/PageBack'
import { Layout } from '../components/Layout'
import { brand } from '../lib/brand'
import { plusPrice, plusYear } from '../lib/plan'
import { count, rules } from '../lib/rules'

const UPDATED = '18 November 2026'

function LegalPage({ title, tag = 'Legal', children }: { title: string; tag?: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <Layout>
      <PageTop tag={tag} fallback="/" />
      <article className="legal">
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="hint">Last updated {UPDATED}.</p>
        {children}
        <p className="legal-links">
          <Link to="/terms">Terms of use</Link> · <Link to="/privacy">Privacy policy</Link> · <Link to="/community-rules">Community rules</Link>
        </p>
      </article>
    </Layout>
  )
}

const { company } = brand
const who = (
  <>
    {brand.name} is run by {company.name} (company number {company.number}), {company.address}
  </>
)
const contact = <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>

export function Terms() {
  const year = plusYear().price
  return (
    <LegalPage title="Terms of use">
      <p>
        {who}. In these terms “we” means us and “you” means you, the member. By joining you agree to these terms, our <Link to="/privacy">privacy policy</Link> and our{' '}
        <Link to="/community-rules">community rules</Link>.
      </p>
      <h2>What {brand.name} is</h2>
      <p>
        A place for adults to find friends to travel with: see who’s going where you’re going, connect, chat, join travel groups and plan trips together. It’s for friendship, not dating. We aren’t a
        travel agent and we don’t sell or book trips.
      </p>
      <h2>Joining</h2>
      <ul>
        <li>
          You must be {rules.age.min} or over. We may ask you to prove your age and identity, and remove anyone who is under {rules.age.min}.
        </li>
        <li>The details you give must be true, and your photos must be of you. One person, one account.</li>
        <li>Keep your password and email account safe. Tell us straight away if you think someone else has used your account.</li>
      </ul>
      <h2>ID checks</h2>
      <p>
        You can check your ID in the app to get a Verified badge. The check is done by Didit, who compare your ID document with a live selfie. A badge shows that a check was passed. It isn’t a promise
        about how someone will behave, so always take the steps in <Link to="/meeting-safely">Meeting up safely</Link>.
      </p>
      <h2>Meeting people</h2>
      <ul>
        <li>You decide who to talk to, meet and travel with. Any trip you arrange is between you and the people you go with.</li>
        <li>Meet in public first, tell someone you trust where you’re going, and never send money to someone you’ve met here.</li>
        <li>We don’t check members’ backgrounds or criminal records.</li>
      </ul>
      <h2>Free and {brand.plusName}</h2>
      <ul>
        <li>
          The free plan lets you send {count(rules.requests.perWeekFree, 'connection request')} a week and start {count(rules.groups.maxOwnedFree, 'group')}.
        </li>
        <li>
          {brand.plusName} costs {plusPrice()} a month or {year} a year, and adds unlimited requests (within fair use, to stop spam) and the extra features shown on the {brand.plusName} page.
        </li>
        <li>
          Founding members get {count(rules.founding.plusMonths, 'month')} of {brand.plusName} free. It ends on its own and you won’t be charged unless you choose to pay.
        </li>
        <li>
          Before you pay we’ll show the price, and you can cancel at any time, effective at the end of the period you’ve paid for. You have 14 days from paying to change your mind and get a full
          refund. We’ll give you at least 30 days’ notice of a price change, and you can cancel before it applies.
        </li>
      </ul>
      <h2>What you post</h2>
      <p>
        You own your photos, words and plans. You let us show them in the app to the members they’re meant for, only to run {brand.name}. Don’t post anything that isn’t yours to share or that breaks
        the community rules.
      </p>
      <h2>Reports and when we step in</h2>
      <p>
        Use <strong>Block or report</strong> on any profile or message. A real person reads every report. We may remove content, give a warning, pause or close an account that breaks these terms or
        the community rules. If we close a paid account for a serious breach we won’t refund the time left; otherwise we will.
      </p>
      <h2>Leaving</h2>
      <p>You can delete your account at any time from Settings, then Account and data. We can also close the service, giving at least 30 days’ notice and refunding any time you’ve paid for and not used.</p>
      <h2>Our responsibility to you</h2>
      <ul>
        <li>We’ll provide the app with reasonable care and skill, but we can’t promise it will always be available or error-free.</li>
        <li>We aren’t responsible for what other members do, on or off the app, or for trips you arrange with them.</li>
        <li>
          Nothing here limits our liability for death or personal injury caused by our negligence, for fraud, or anything else the law doesn’t let us limit, and nothing affects your rights under UK
          consumer law.
        </li>
      </ul>
      <h2>Changes and the law</h2>
      <p>
        If we change these terms we’ll tell you in the app before the change applies. These terms are governed by the law of England and Wales, and you can bring a claim in the courts where you live
        in the UK. Questions? Email {contact}.
      </p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This explains what we collect, why, who sees it and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018). {who} is the controller of your details, registered
        with the Information Commissioner’s Office (number {company.icoNumber}). Contact us at {contact}.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and password (stored scrambled, we can never read it).
        </li>
        <li>
          <strong>Profile:</strong> first name, date of birth, gender, home town, photos, headline, bio, interests, travel style and any optional answers about how you travel.
        </li>
        <li>
          <strong>Activity:</strong> your trips and dates, places you’d like to go, connections, messages, groups, plan boards, tips you share and when you last used the app.
        </li>
        <li>
          <strong>Safety:</strong> blocks and reports you make or that are made about you, and the result of any ID check.
        </li>
        <li>
          <strong>Plan:</strong> whether you’re on the free plan or {brand.plusName}, and which {brand.plusName} prices you’ve seen or tapped. Card payments, once offered, are handled by the payment
          company; we never see your full card number.
        </li>
      </ul>
      <h2>Optional details that may be sensitive</h2>
      <p>
        If you choose to add a note about access or mobility needs, it may say something about your health. We only use it to show the members you choose, with your consent, and you can delete it at
        any time. We don’t ask about sexuality, religion or ethnicity.
      </p>
      <h2>ID checks</h2>
      <p>
        If you choose to check your ID, Didit (our ID check provider) takes a photo of your ID document and a live selfie, and checks that they match and that you’re {rules.age.min} or over. Your face
        is processed as biometric data, so we ask for your explicit consent first, and you can use the app without doing a check. We receive only the result, your name and date of birth from the
        document, and a reference number. We don’t keep copies of your document or selfie. Didit keeps them only as long as it needs to complete and prove the check.
      </p>
      <h2>Why we use your details (and our legal basis)</h2>
      <ul>
        <li>
          <strong>To run the service you joined</strong> (contract): your account, showing your profile, suggesting people going where and when you are, connections, chat, groups and plans.
        </li>
        <li>
          <strong>To keep members safe</strong> (legitimate interests): checking ages, looking at reports, blocking, and scanning messages automatically for common scams, such as requests for money,
          so we can warn the reader.
        </li>
        <li>
          <strong>To improve the app</strong> (legitimate interests): counting how features and prices are used, without selling or sharing it.
        </li>
        <li>
          <strong>ID checks and health notes</strong> (your explicit consent), which you can withdraw at any time.
        </li>
        <li>
          <strong>Legal duties</strong> (legal obligation): keeping payment records and helping the police when the law requires it.
        </li>
      </ul>
      <p>We don’t sell your details, we don’t show adverts, and we don’t make decisions about you by computer alone that have legal or similarly big effects.</p>
      <h2>Who can see what</h2>
      <ul>
        <li>Other members see your first name, age (never your date of birth), home town, photos, profile answers, interests and the trips you choose to share.</li>
        <li>Messages are seen only by the people in that chat. Our founder, who runs {brand.name}, reads a message only when it’s reported or flagged as a possible scam.</li>
        <li>Reports are reviewed by our founder in person. The person you report isn’t told who reported them.</li>
      </ul>
      <h2>Companies that help us</h2>
      <p>These companies process details for us under contract, only to provide their service:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: our database, sign-in and photo storage.
        </li>
        <li>
          <strong>Cloudflare</strong>: hosts the app and handles its web traffic.
        </li>
        <li>
          <strong>Google (Gmail)</strong>: sends sign-in codes and account emails.
        </li>
        <li>
          <strong>Didit</strong>: ID and age checks, only if you choose to do one.
        </li>
        <li>
          <strong>Unsplash, Wikipedia and OpenStreetMap</strong>: place photos and maps. Your device asks them for images directly, so they see your IP address, but none of your profile.
        </li>
      </ul>
      <p>
        Some of these companies may store or access details outside the UK, for example in the US or the EU. When they do, we rely on UK adequacy rules or the UK’s approved data transfer agreements to
        protect your details.
      </p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Your profile, trips and messages: while you’re a member. When you delete your account we delete them within 30 days (backups clear within a further 30 days).</li>
        <li>Messages you sent to others may stay in their chat history, shown without your profile.</li>
        <li>Safety reports and ID check results: up to 2 years after the account closes, so we can stop banned members rejoining and deal with complaints.</li>
        <li>Payment records: 6 years, because the law requires it.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your details, ask us to correct or delete them, ask us to restrict or stop using them, object to how we use them, and ask for a copy you can take elsewhere. Email{' '}
        {contact} and we’ll reply within one month. You can delete your account yourself in Settings, then Account and data.
      </p>
      <p>
        If you’re unhappy with how we’ve used your details, please tell us first. You can also complain to the Information Commissioner’s Office at <a href="https://ico.org.uk">ico.org.uk</a> or on
        0303 123 1113.
      </p>
      <h2>Cookies</h2>
      <p>We don’t use advertising or tracking cookies. Your browser stores only what’s needed to keep you signed in and remember your settings, so we don’t need to ask for cookie consent.</p>
      <h2>Changes</h2>
      <p>If we make an important change to this policy, we’ll tell you in the app before it applies.</p>
    </LegalPage>
  )
}

export function CommunityRules() {
  return (
    <LegalPage title="Community rules" tag="Community">
      <p>
        {brand.name} works because members trust each other. Breaking these rules can lead to a warning, a pause or removal. Use <strong>Block or report</strong> on any profile or message, and a real
        person will review it.
      </p>
      <ol className="rules numbered-list">
        <li>
          <strong>Friendship, not dating.</strong> {brand.name} is for finding people to travel with. Don’t use it to look for romance.
        </li>
        <li>
          <strong>Be yourself.</strong> Use your real first name, age and a recent photo of you.
        </li>
        <li>
          <strong>Be kind and respectful.</strong> No harassment, hate, threats or unwanted romantic or sexual messages.
        </li>
        <li>
          <strong>Never ask for money.</strong> No loans, gifts, bank details, gift cards or crypto, for any reason.
        </li>
        <li>
          <strong>No selling.</strong> Don’t promote businesses, tours or other apps.
        </li>
        <li>
          <strong>Respect a no.</strong> If someone declines or stops replying, leave it there.
        </li>
        <li>
          <strong>Keep it private.</strong> Don’t share other members’ details, photos or messages outside the app.
        </li>
        <li>
          <strong>Meet safely.</strong> Meet in public first and tell someone your plans. See <Link to="/meeting-safely">Meeting up safely</Link>.
        </li>
      </ol>
    </LegalPage>
  )
}
