"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ShieldIcon,
  HeadsetIcon,
  HeartIcon,
  StoreIcon,
} from "@/components/icons";

const SUPPORT_EMAIL = "contact@subha.fun";

const categories = [
  {
    title: "Account & Login",
    description: "Sign-in, profile and account issues",
    Icon: ShieldIcon,
    href: "mailto:contact@subha.fun?subject=Account%20%26%20Login%20Support",
  },
  {
    title: "Payments & Coins",
    description: "Coins, diamonds and purchases",
    Icon: StoreIcon,
    href: "mailto:contact@subha.fun?subject=Payment%20Support",
  },
  {
    title: "Live Rooms",
    description: "Rooms, streaming and viewers",
    Icon: HeadsetIcon,
    href: "mailto:contact@subha.fun?subject=Live%20Room%20Support",
  },
  {
    title: "Technical Issues",
    description: "Something isn't working correctly",
    Icon: HeadsetIcon,
    href: "mailto:contact@subha.fun?subject=Technical%20Support",
  },
  {
    title: "Reports & Safety",
    description: "Report abuse or suspicious activity",
    Icon: ShieldIcon,
    href: "mailto:contact@subha.fun?subject=Safety%20Report",
  },
  {
    title: "Something else",
    description: "Anything we haven't covered",
    Icon: HeartIcon,
    href: "mailto:contact@subha.fun?subject=Subha%20Support%20Request",
  },
];

const faqs = [
  {
    question: "I can't log into my account",
    answer:
      "Make sure you're using the same sign-in method you originally used. If you're still unable to access your account, contact us and include the email associated with your Subha account.",
  },
  {
    question: "My coins or diamonds are missing",
    answer:
      "Don't make another purchase immediately. Contact support with your account ID, what happened, and any relevant transaction details so we can investigate it.",
  },
  {
    question: "Something isn't working in a live room",
    answer:
      "Try leaving and re-entering the room first. If the problem continues, contact support with the room ID and a short description of what went wrong.",
  },
  {
    question: "How do I report someone?",
    answer:
      "Use the reporting controls available around the relevant user or room. For urgent safety issues, contact support directly with as much context as possible.",
  },
];

export default function SupportPage() {
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard may be unavailable.
    }
  }

  return (
    <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-5 sm:px-6">
        {/* Header */}
        <header className="flex items-center gap-3">
          <Link
            href="/home/me"
            aria-label="Back to profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2A2238] bg-[#1D1829] text-[#C9C1D0] transition-colors hover:bg-[#2A2238] hover:text-[#F3ECE0]"
          >
            <span
              aria-hidden="true"
              className="text-xl leading-none"
            >
              ←
            </span>
          </Link>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#CBA35C]">
              Subha Support
            </p>

            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
              Need a hand?
            </h1>
          </div>
        </header>

        {/* Hero */}
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-[#CBA35C]/20 bg-gradient-to-br from-[#241D1A] via-[#1D1829] to-[#17131F] p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#CBA35C]/10 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-[#D98FA0]/5 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#CBA35C]/20 bg-[#CBA35C]/10">
              <HeadsetIcon className="h-6 w-6 text-[#CBA35C]" />
            </div>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              We're here to help.
            </h2>

            <p className="mt-2 max-w-lg text-sm leading-6 text-[#AFA7B8]">
              Tell us what's going on and we'll help you
              figure it out. For anything urgent, contact
              us directly.
            </p>

            {/* Primary email CTA */}
            <div className="mt-6 rounded-2xl border border-[#CBA35C]/20 bg-[#17131F]/60 p-3">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Subha%20Support%20Request`}
                className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#2A2238]/60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#CBA35C] text-lg text-[#17131F]">
                  ✉
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-[#9088A0]">
                    Email support
                  </span>

                  <span className="mt-0.5 block truncate text-sm font-semibold text-[#F3ECE0]">
                    {SUPPORT_EMAIL}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className="text-xl text-[#9088A0] transition-transform group-hover:translate-x-0.5"
                >
                  ›
                </span>
              </a>

              <button
                type="button"
                onClick={copyEmail}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#9088A0] transition-colors hover:bg-[#2A2238]/60 hover:text-[#F3ECE0]"
              >
                <span aria-hidden="true">⧉</span>

                {copied
                  ? "Email copied"
                  : "Copy email address"}
              </button>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mt-8">
          <div>
            <h2 className="text-lg font-semibold">
              What can we help with?
            </h2>

            <p className="mt-1 text-sm text-[#9088A0]">
              Choose a topic or contact us directly.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {categories.map(
              ({
                title,
                description,
                Icon,
                href,
              }) => (
                <a
                  key={title}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-[#2A2238] bg-[#1D1829]/70 p-4 transition-all hover:-translate-y-0.5 hover:border-[#3A3050] hover:bg-[#211B2E]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2A2238]">
                    <Icon className="h-5 w-5 text-[#CBA35C]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#F3ECE0]">
                      {title}
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-[#9088A0]">
                      {description}
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-lg text-[#665D72] transition-transform group-hover:translate-x-0.5 group-hover:text-[#CBA35C]"
                  >
                    ›
                  </span>
                </a>
              ),
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-9">
          <div>
            <h2 className="text-lg font-semibold">
              Common questions
            </h2>

            <p className="mt-1 text-sm text-[#9088A0]">
              Quick answers to common problems.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[#2A2238] bg-[#1D1829]/70">
            {faqs.map((faq, index) => {
              const open = openFaq === index;

              return (
                <div
                  key={faq.question}
                  className={
                    index !== 0
                      ? "border-t border-[#2A2238]"
                      : ""
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaq(
                        open ? null : index,
                      )
                    }
                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-[#2A2238]/30"
                    aria-expanded={open}
                  >
                    <span className="flex-1 text-sm font-medium text-[#E8E1EA]">
                      {faq.question}
                    </span>

                    <span
                      aria-hidden="true"
                      className={`text-lg text-[#9088A0] transition-transform ${
                        open ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 pr-12">
                      <p className="text-sm leading-6 text-[#9088A0]">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom contact */}
        <section className="mt-8 rounded-2xl border border-[#2A2238] bg-[#1D1829]/50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2238]">
            <HeadsetIcon className="h-5 w-5 text-[#D98FA0]" />
          </div>

          <h2 className="mt-3 text-sm font-semibold">
            Still need help?
          </h2>

          <p className="mt-1 text-xs leading-5 text-[#9088A0]">
            Our support team can help with anything
            that isn't covered here.
          </p>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Subha%20Support%20Request`}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#CBA35C]/30 px-4 py-2 text-xs font-semibold text-[#CBA35C] transition-colors hover:bg-[#CBA35C]/10"
          >
            <span aria-hidden="true">✉</span>
            {SUPPORT_EMAIL}
          </a>
        </section>

        <p className="mt-6 text-center text-[11px] text-[#5F576B]">
          Subha Support
        </p>
      </div>
    </main>
  );
}