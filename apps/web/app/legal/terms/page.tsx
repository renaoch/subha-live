import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  UserRound,
  Radio,
  Ban,
  Scale,
} from "lucide-react";

export default function TermsPage() {
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
              className="font-medium text-ink"
            >
              Terms
            </Link>

            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-accent"
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
        {/* Page heading */}
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-accent">
            Legal
          </p>

          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Terms & Conditions
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">
            These Terms & Conditions explain the rules and
            responsibilities that apply when you use Subha.
          </p>

          <p className="mt-3 text-xs text-ink-muted/70">
            Last updated: August 18, 2026
          </p>
        </section>

        {/* Intro card */}
        <section className="mt-10 rounded-2xl border border-border/50 bg-surface-raised/40 p-5 backdrop-blur-xl sm:p-6 lg:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>

            <div>
              <h2 className="font-semibold text-ink">
                Welcome to Subha
              </h2>

              <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-[15px] sm:leading-7">
                By creating an account, accessing, or using
                Subha, you agree to these Terms & Conditions.
                Please read them carefully before using the
                service.
              </p>
            </div>
          </div>
        </section>

        {/* Main legal content */}
        <article className="mt-10 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-14">
          {/* Desktop contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Contents
              </p>

              <nav className="mt-4 space-y-2 border-l border-border/60 pl-4 text-sm text-ink-muted">
                <a
                  href="#account"
                  className="block transition-colors hover:text-accent"
                >
                  Your Account
                </a>

                <a
                  href="#content"
                  className="block transition-colors hover:text-accent"
                >
                  User Content
                </a>

                <a
                  href="#prohibited"
                  className="block transition-colors hover:text-accent"
                >
                  Prohibited Activities
                </a>

                <a
                  href="#moderation"
                  className="block transition-colors hover:text-accent"
                >
                  Moderation
                </a>

                <a
                  href="#intellectual-property"
                  className="block transition-colors hover:text-accent"
                >
                  Intellectual Property
                </a>

                <a
                  href="#third-party"
                  className="block transition-colors hover:text-accent"
                >
                  Third-Party Services
                </a>

                <a
                  href="#availability"
                  className="block transition-colors hover:text-accent"
                >
                  Availability
                </a>

                <a
                  href="#termination"
                  className="block transition-colors hover:text-accent"
                >
                  Termination
                </a>

                <a
                  href="#disclaimer"
                  className="block transition-colors hover:text-accent"
                >
                  Disclaimers
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

          {/* Legal text */}
          <div className="min-w-0 space-y-10">
            {/* 1 */}
            <section id="account" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <UserRound className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  1. Your Account
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                You may need an account to use certain Subha
                features. You are responsible for providing
                accurate information and keeping your account
                credentials secure.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                You are responsible for activity performed
                through your account. If you believe your
                account has been accessed without your
                permission, you should take reasonable steps to
                secure it and contact Subha support.
              </p>
            </section>

            {/* 2 */}
            <section id="content" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Radio className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  2. Streaming & User Content
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha allows users to stream, communicate,
                share content, and interact with other users.
                You remain responsible for content that you
                create, upload, broadcast, or otherwise share
                through Subha.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                You must have the necessary rights and
                permissions to share content through the
                service. You must not use Subha to distribute
                content that violates applicable laws or the
                rights of others.
              </p>
            </section>

            {/* 3 */}
            <section id="prohibited" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Ban className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  3. Prohibited Activities
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                You may not use Subha to:
              </p>

              <ul className="mt-4 space-y-3 text-sm leading-7 text-ink-muted sm:text-[15px]">
                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Break applicable laws or regulations.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Harass, threaten, abuse, or deliberately
                    harm other users.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Impersonate another person or organization.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Attempt to gain unauthorized access to
                    accounts, systems, or infrastructure.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Interfere with the operation or security of
                    Subha.
                  </span>
                </li>

                <li className="flex gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    Upload or distribute malicious software or
                    harmful material.
                  </span>
                </li>
              </ul>
            </section>

            {/* 4 */}
            <section id="moderation" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                4. Community & Moderation
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha may provide tools for reporting,
                moderation, blocking, or restricting users and
                content. We may review or take action on
                content or accounts when reasonably necessary
                to enforce these Terms, protect users, maintain
                security, or comply with applicable law.
              </p>
            </section>

            {/* 5 */}
            <section
              id="intellectual-property"
              className="scroll-mt-24"
            >
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                5. Intellectual Property
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha, including its software, branding, design,
                logos, and original platform content, is
                protected by applicable intellectual property
                laws.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                These Terms do not give you ownership of Subha
                or its underlying technology. You retain rights
                to content you own, subject to the permissions
                necessary for Subha to provide its services.
              </p>
            </section>

            {/* 6 */}
            <section id="third-party" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                6. Third-Party Services
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha may integrate with third-party services
                such as authentication providers, hosting
                providers, storage services, analytics tools,
                and other infrastructure providers.
              </p>

              <p className="mt-4 text-sm leading-7 text-ink-muted sm:text-[15px]">
                Your use of third-party services may also be
                subject to the terms and policies of those
                providers.
              </p>
            </section>

            {/* 7 */}
            <section id="availability" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                7. Availability
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may modify, suspend, or discontinue parts of
                Subha as the service develops. We do not
                guarantee that every feature will always be
                available or uninterrupted.
              </p>
            </section>

            {/* 8 */}
            <section id="termination" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                8. Account Suspension or Termination
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may suspend or terminate an account when we
                reasonably believe that the account has violated
                these Terms, created a security or safety risk,
                abused the service, or otherwise requires action
                to protect Subha or its users.
              </p>
            </section>

            {/* 9 */}
            <section id="disclaimer" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2.5">
                <Scale className="h-4 w-4 text-accent" />

                <h2 className="text-lg font-semibold text-ink sm:text-xl">
                  9. Disclaimers
                </h2>
              </div>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                Subha is provided on an as-available basis. To
                the extent permitted by applicable law, we do not
                guarantee that the service will always be
                available, error-free, secure, or suitable for
                every purpose.
              </p>
            </section>

            {/* 10 */}
            <section id="changes" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                10. Changes to These Terms
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                We may update these Terms as Subha evolves. If
                we make significant changes, we may provide
                notice through the application or another
                appropriate method.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink sm:text-xl">
                11. Contact
              </h2>

              <p className="text-sm leading-7 text-ink-muted sm:text-[15px]">
                If you have questions about these Terms, contact
                the Subha team through the support contact
                provided in the application.
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
                className="font-medium text-ink"
              >
                Terms
              </Link>

              <Link
                href="/legal/privacy"
                className="transition-colors hover:text-accent"
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