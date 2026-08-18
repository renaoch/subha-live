"use client";

import * as React from "react";
import Image from "next/image";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { GoogleIcon, FacebookIcon } from "@/components/icons/brand-icons";
import { SocialButton } from "@/components/auth/social-button";
import { ThemeToggle } from "@/components/theme-toggle";

type Provider = "google" | "facebook" | null;

export function AuthScreen() {
  const [loadingProvider, setLoadingProvider] =
    React.useState<Provider>(null);

  async function handleOAuth(
    provider: Exclude<Provider, null>,
  ) {
    if (loadingProvider) return;

    setLoadingProvider(provider);

    try {
      const res = await fetch(`/api/auth/${provider}`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("oauth_failed");
      }

      toast.success(
        provider === "google"
          ? "Signed in with Google"
          : "Signed in with Facebook",
        {
          description: "Taking you to the live feed…",
        },
      );
    } catch {
      toast.error("Couldn't sign you in", {
        description: `We couldn't reach ${
          provider === "google" ? "Google" : "Facebook"
        }. Try again in a moment.`,
      });
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-Subha-gradient">
      {/* Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Top purple glow */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[120px]" />

        {/* Center glow */}
        <div className="absolute left-1/2 top-[38%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.06] blur-[120px]" />

        {/* Bottom left */}
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px]" />

        {/* Bottom right */}
        <div className="absolute -bottom-32 -right-40 h-[450px] w-[450px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />

        {/* Bottom waves */}
        <div className="absolute -bottom-[250px] left-1/2 h-[420px] w-[150%] -translate-x-1/2 rounded-[50%] bg-accent/[0.08]" />

        <div className="absolute -bottom-[290px] left-1/2 h-[420px] w-[135%] -translate-x-1/2 rounded-[50%] bg-accent-hot/[0.08]" />
      </div>

      {/* Theme toggle */}
      <div className="absolute right-5 top-5 z-30 sm:right-7 sm:top-7">
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center px-6 pb-7 pt-10 sm:px-8 sm:pt-14 lg:max-w-[560px]">
        {/* Logo */}
        <div className="shrink-0">
          <span className="font-display text-[2.2rem] font-bold uppercase tracking-[-0.05em] bg-gradient-to-r from-accent to-accent-hot bg-clip-text text-transparent sm:text-[2.45rem]">
            SUBHA
          </span>
        </div>

        {/* Hero */}
        <section className="mt-8 flex w-full flex-col items-center sm:mt-10">
          {/* Mascot */}
          <div className="relative h-52 w-52 sm:h-60 sm:w-60">
            <div
              aria-hidden
              className="absolute inset-8 rounded-full bg-gradient-to-b from-accent/20 via-accent/10 to-accent-hot/10 blur-2xl"
            />

            <Image
              src="/mascot.png"
              alt="Subha mascot"
              fill
              sizes="240px"
              priority
              className="relative object-contain drop-shadow-[0_20px_30px_rgba(76,40,150,0.25)]"
            />
          </div>

          {/* Heading */}
          <div className="mt-5 space-y-1.5 text-center">
            <h1 className="font-display text-[1.8rem] font-semibold tracking-[-0.03em] text-ink sm:text-[2rem]">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-accent to-accent-hot bg-clip-text text-transparent">
                Subha
              </span>
            </h1>

            <p className="text-sm text-ink-muted sm:text-[15px]">
              Connect, stream, and{" "}
              <span className="font-semibold text-accent">
                play
              </span>
              .
            </p>
          </div>
        </section>

        {/* Authentication */}
        <section className="mt-10 w-full sm:mt-12">
          <div className="space-y-3">
            {/* Google */}
            <SocialButton
              icon={<GoogleIcon />}
              label="Continue with Google"
              variant="outline"
              className="h-[54px] border-black/10 bg-white text-[#1c1330] shadow-sm transition-all hover:border-accent/40 hover:bg-white hover:shadow-md"
              loading={loadingProvider === "google"}
              disabled={
                loadingProvider !== null &&
                loadingProvider !== "google"
              }
              onClick={() => handleOAuth("google")}
            />

            {/* Facebook */}
            <SocialButton
              icon={<FacebookIcon />}
              label="Continue with Facebook"
              variant="solid"
              className="h-[54px] shadow-sm transition-all hover:shadow-md"
              loading={loadingProvider === "facebook"}
              disabled={
                loadingProvider !== null &&
                loadingProvider !== "facebook"
              }
              onClick={() => handleOAuth("facebook")}
            />

            {/* Divider */}
            <div className="flex items-center gap-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted/70">
              <span className="h-px flex-1 bg-border/60" />

              <span>or</span>

              <span className="h-px flex-1 bg-border/60" />
            </div>

            {/* Email */}
            <a
              href="/auth/email"
              className="group flex h-[54px] w-full items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface-raised/60 px-5 text-sm font-medium text-ink shadow-sm backdrop-blur-md transition-all hover:border-accent/40 hover:bg-white/10 hover:shadow-md"
            >
              <Mail className="h-[19px] w-[19px] text-accent transition-colors group-hover:text-accent-hot" />

              <span>Continue with email</span>
            </a>
          </div>
        </section>

        {/* Signup */}
        <p className="mt-6 text-sm text-ink-muted">
          New here?{" "}
          <a
            href="/auth/signup"
            className="font-medium text-ink underline decoration-ink/20 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent/40"
          >
            Create an account
          </a>
        </p>

        {/* Terms */}
        <div className="mt-5 flex w-full items-start gap-2.5 px-2 text-left sm:px-4">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted/70"
            strokeWidth={1.8}
          />

          <p className="text-[10.5px] leading-[1.55] text-ink-muted/75">
            By using Subha, you agree to our{" "}
            <a
              href="/legal/terms"
              className="font-medium text-ink underline underline-offset-2 transition-colors hover:text-accent"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              className="font-medium text-ink underline underline-offset-2 transition-colors hover:text-accent"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}