import Link from "next/link";
import {
  ArrowLeft,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  Database,
  Share2,
  Trash2,
  Baby,
} from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient text-ink">
      {/* Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-48 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[140px]" />

        <div className="absolute left-0 top-[35%] h-[500px] w-[500px] rounded-full bg-accent/[0.05] blur-[140px]" />

        <div className="absolute -bottom-48 right-0 h-[600px] w-[600px] rounded-full bg-accent-hot/[0.07] blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-border/40 bg-background/20 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8 lg:px-10">
          {/* Logo */}
          <Link
            href="/"
            className="font-display text-xl font-bold uppercase tracking-[-0.04em] bg-gradient-to-r from-accent to-accent-hot bg-clip-text text-transparent"
          >
            SUBHA
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-6 text-sm text-ink-muted sm:flex">
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-accent"
            >
              Terms
            </Link>

            <Link
              href="/legal/privacy"
              className="font-medium text-ink"
            >
              Privacy
            </Link>

            <Link
              href="/auth"
              className="rounded-lg border border-border/60 bg-surface-raised/50 px-4 py-2 font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
            >
              Sign in
            </Link>
          </nav>

          {/* Mobile back */}
          <Link
            href="/auth"
            aria-label="Back to sign in"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface-raised/50 text-ink-muted backdrop-blur-md transition-colors hover:border-accent/40 hover:text-accent sm:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Page */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-10 lg:pt-16">
        {/* Heading */}
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-accent">
            Legal
          </p>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Privacy Policy
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">
            This Privacy Policy explains what information Subha
            may collect, how we use it, and the choices available
            to you.
          </p>

          <p className="mt-3 text-xs text-ink-muted/70">
            Last updated: August 18, 2026
          </p>
        </section>

        {/* Intro */}
        <section className="mt-10 rounded-2xl border border-border/50 bg-surface-raised/40 p-5 backdrop-blur-xl sm:p-6 lg:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <LockKeyhole className="h-5 w-5 text-accent" />
            </div>

            <div>
              <h2 className="font-semibold text-ink">
                Your privacy matters
              </h2>

              <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-[15px] sm:leading-7">
                Subha is designed to provide social, streaming,
                and communication features while handling your
                information responsibly. This policy describes
                the information that may be processed when you
                use the service.
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <article className="mt-10 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-14">
          {/* Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Contents
              </p>

              <nav className="mt-4 space-y-2 border-l border-border/60 pl-4 text-sm text-ink-muted">
                <a
                  href="#information"
                  className="block transition-colors hover:text-accent"
                >
                  Information We Collect
                </a>

                <a
                  href="#usage"
                  className="block transition-colors hover:text-accent"
                >
                  How We Use Information
                </a>

                <a
                  href="#authentication"
                  className="block transition-colors hover:text-accent"
                >
                  Authentication
                </a>

                <a
                  href="#content"
                  className="block transition-colors hover:text-accent"
                >
                  User Content
                </a>

                <a
                  href="#technical"
                  className="block transition-colors hover:text-accent"
                >
                  Technical Information
                </a>

                <a
                  href="#sharing"
                  className="block transition-colors hover:text-accent"
                >
                  Information Sharing
                </a>

                <a
                  href="#third-party"
                  className="block transition-colors hover:text-accent"
                >
                  Third-Party Services
                </a>

                <a
                  href="#retention"
                  className="block transition-colors hover:text-accent"
                >
                  Data Retention
                </a>

                <a
                  href="#deletion"
                  className="block transition-colors hover:text-accent"
                >
                  Account Deletion
                </a>

                <a
                  href="#security"
                  className="block transition-colors hover:text-accent"
                >
                  Security
                </a>

                <a
                  href="#children"
                  className="block transition-colors hover:text-accent"
                >
                  Children's Privacy
                </a>

                <a
                  href="#rights"
                  className="block transition-colors hover:text-accent"
                >
                  Your Rights
                </a>

                <a
                  href="#changes"
                  className="block transition-colors hover:text-accent"
                >
                  Changes
                </a>
              </nav>
            </div>
          </aside>

          {/* Main text */}
          <div className="min-w-0 space-y-10">
            {/* 1 */}
            <section id="information" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Database className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  1. Information We Collect
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Depending on how you use Subha, we may collect
                information needed to create and operate your
                account, such as your name, email address,
                profile information, and authentication details.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may also process information that you
                voluntarily provide through features such as
                profiles, streams, messages, or other
                interactions.
              </p>
            </section>

            {/* 2 */}
            <section id="usage" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                2. How We Use Information
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may use information to:
              </p>

              <ul className="mt-4 space-y-3 text-sm leading-7 text-ink-muted sm:text-[15px]">
                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Create and manage your Subha account.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Provide streaming, communication, and social
                    features.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Authenticate users and protect accounts.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Maintain and improve the reliability of the
                    service.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Detect abuse, fraud, security issues, and
                    violations of our Terms.
                  </span>
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section id="authentication" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <UserRound className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  3. Authentication Providers
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                If you choose to sign in using Google, Facebook,
                or another supported authentication provider,
                Subha may receive information from that provider
                that is necessary to authenticate your account.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                The information provided by an authentication
                provider is handled according to the provider's
                own policies as well as this Privacy Policy.
              </p>
            </section>

            {/* 4 */}
            <section id="content" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                4. User Content
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha allows users to create, upload, stream,
                transmit, and share content. Depending on the
                feature being used, content may be processed or
                stored so that the requested functionality can
                operate.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                You should avoid sharing sensitive personal
                information publicly through streams, profiles,
                messages, or other user-facing features.
              </p>
            </section>

            {/* 5 */}
            <section id="technical" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                5. Technical Information
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may process technical information needed to
                operate and secure the service. This may include
                information such as device information, browser
                information, IP address, application version,
                diagnostic information, and basic usage events.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                The exact information collected may vary
                depending on the platform, features you use, and
                the infrastructure supporting Subha.
              </p>
            </section>

            {/* 6 */}
            <section id="sharing" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Share2 className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  6. Information Sharing
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We do not treat your personal information as
                something to casually hand to unrelated third
                parties. Information may be shared when
                reasonably necessary to provide the service,
                operate infrastructure, comply with legal
                obligations, protect users, or enforce our Terms.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                Information that you intentionally make public,
                such as public profile information or publicly
                shared content, may be visible to other users.
              </p>
            </section>

            {/* 7 */}
            <section id="third-party" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                7. Third-Party Services
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha may rely on third-party services for
                authentication, hosting, databases, storage,
                analytics, communication, monitoring, and other
                infrastructure.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                These providers may process information on our
                behalf or according to their own terms and
                privacy policies.
              </p>
            </section>

            {/* 8 */}
            <section id="retention" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                8. Data Retention
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We retain information for as long as reasonably
                necessary to provide the service, maintain
                security, meet operational requirements, resolve
                disputes, and comply with applicable legal
                obligations.
              </p>
            </section>

            {/* 9 */}
            <section id="deletion" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Trash2 className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  9. Account Deletion
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Depending on the version of the application,
                account deletion may be available through the
                application or by contacting Subha support.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                When an account is deleted, information may be
                removed or anonymized within a reasonable period,
                subject to information that we are required or
                permitted to retain for legal, security, fraud
                prevention, or legitimate operational purposes.
              </p>
            </section>

            {/* 10 */}
            <section id="security" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  10. Security
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We use reasonable technical and organizational
                measures designed to protect information against
                unauthorized access, loss, misuse, or alteration.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                However, no internet-based service can guarantee
                absolute security. You should also take reasonable
                steps to protect your account and credentials.
              </p>
            </section>

            {/* 11 */}
            <section id="children" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Baby className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  11. Children's Privacy
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha is not intended for users who are below
                the minimum age required to use the service under
                applicable law. We do not knowingly collect
                personal information from children in violation
                of applicable legal requirements.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                If you believe that a child has provided personal
                information to Subha inappropriately, contact us
                so that we can review the situation and take
                appropriate action.
              </p>
            </section>

            {/* 12 */}
            <section id="rights" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                12. Your Privacy Rights
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Depending on where you live and applicable law,
                you may have rights relating to your personal
                information, including rights to access,
                correction, deletion, restriction, or other
                privacy choices.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                Requests can be made through the support contact
                provided by Subha. We may need to verify your
                identity before processing certain requests.
              </p>
            </section>

            {/* 13 */}
            <section id="changes" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                13. Changes to This Privacy Policy
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may update this Privacy Policy as Subha
                develops, our services change, or applicable
                requirements change. Important updates may be
                communicated through the application or another
                appropriate method.
              </p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                14. Contact
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                If you have questions, concerns, or requests
                regarding this Privacy Policy or your personal
                information, contact the Subha team through the
                support contact provided in the application.
              </p>
            </section>
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-16 border-t border-border/50 pt-7">
          <div className="flex flex-col gap-4 text-center text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p>
              © 2026 Subha. All rights reserved.
            </p>

            <div className="flex justify-center gap-5 sm:justify-end">
              <Link
                href="/legal/terms"
                className="transition-colors hover:text-accent"
              >
                Terms
              </Link>

              <Link
                href="/legal/privacy"
                className="font-medium text-ink"
              >
                Privacy
              </Link>

              <Link
                href="/auth"
                className="transition-colors hover:text-accent"
              >
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}