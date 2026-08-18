"use client";

import * as React from "react";
import Image from "next/image";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  GoogleIcon,
  FacebookIcon,
} from "@/components/icons/brand-icons";
import { SocialButton } from "@/components/auth/social-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { authApi } from "@/lib/api/auth";

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
      const result =
        provider === "google"
          ? await authApi.signInWithGoogle()
          : await authApi.signInWithFacebook();

      if (result.error) {
        throw result.error;
      }

      /*
       * Supabase handles the browser redirect here.
       *
       * Google:
       *   Subha → Supabase → Google → Supabase
       *   → /auth/callback → authenticated session
       *
       * Facebook follows the same flow.
       */
    } catch (error) {
      console.error(
        `${provider} OAuth error:`,
        error,
      );

      toast.error("Couldn't sign you in", {
        description:
          provider === "google"
            ? "We couldn't start Google sign-in. Try again in a moment."
            : "We couldn't start Facebook sign-in. Try again in a moment.",
      });

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
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[120px]" />

        <div className="absolute left-1/2 top-[38%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.06] blur-[120px] animate-[pulseGlow_8s_ease-in-out_infinite]" />

        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[120px]" />

        <div className="absolute -bottom-32 -right-40 h-[450px] w-[450px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />

        <div className="absolute -bottom-[250px] left-1/2 h-[420px] w-[150%] -translate-x-1/2 rounded-[50%] bg-accent/[0.08]" />

        <div className="absolute -bottom-[290px] left-1/2 h-[420px] w-[135%] -translate-x-1/2 rounded-[50%] bg-accent-hot/[0.08]" />

        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* Theme toggle */}
      <div className="absolute right-5 top-5 z-30 sm:right-7 sm:top-7 animate-[fadeIn_0.5s_ease-out]">
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center px-6 pb-7 pt-10 sm:px-8 sm:pt-14 lg:max-w-[560px]">
        {/* Logo */}
        <div className="shrink-0 animate-[fadeIn_0.6s_ease-out]">
          <span
            className="font-display text-[2.2rem] font-bold uppercase tracking-[-0.05em] bg-clip-text text-transparent sm:text-[2.45rem]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--accent) 0%, var(--accent-hot) 50%, var(--accent) 100%)",
              backgroundSize: "200% auto",
              animation:
                "gradientShift 6s ease-in-out infinite",
            }}
          >
            SUBHA
          </span>
        </div>

        {/* Hero */}
        <section className="mt-8 flex w-full flex-col items-center sm:mt-10">
          {/* Mascot with orbiting particles */}
          <div className="relative h-52 w-52 sm:h-60 sm:w-60 animate-[floatIn_0.7s_ease-out_0.1s_both]">
            <div
              aria-hidden
              className="absolute inset-8 rounded-full bg-gradient-to-b from-accent/20 via-accent/10 to-accent-hot/10 blur-2xl"
            />

            {/* Orbiting particles */}
            <div
              aria-hidden
              className="absolute inset-0 animate-[orbit_14s_linear_infinite]"
            >
              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_2px] shadow-accent/60" />
            </div>

            <div
              aria-hidden
              className="absolute inset-0 animate-[orbit_10s_linear_infinite_reverse]"
            >
              <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-accent-hot shadow-[0_0_8px_2px] shadow-accent-hot/60" />
            </div>

            <div
              aria-hidden
              className="absolute inset-0 animate-[orbit_18s_linear_infinite]"
              style={{ animationDelay: "-4s" }}
            >
              <span className="absolute bottom-4 left-0 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_8px_2px] shadow-fuchsia-300/50" />
            </div>

            <div className="relative h-full w-full animate-[breathe_5s_ease-in-out_infinite]">
              <Image
                src="/mascot.png"
                alt="Subha mascot"
                fill
                sizes="240px"
                priority
                className="object-contain drop-shadow-[0_20px_30px_rgba(76,40,150,0.25)]"
              />
            </div>

            {/* Grounding shadow */}
            <div
              aria-hidden
              className="absolute bottom-1 left-1/2 h-4 w-24 -translate-x-1/2 rounded-full bg-black/30 blur-md animate-[shadowPulse_5s_ease-in-out_infinite]"
            />
          </div>

          {/* Heading */}
          <div className="mt-6 space-y-1.5 text-center animate-[fadeIn_0.6s_ease-out_0.2s_both]">
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
        <section className="mt-11 w-full sm:mt-14 animate-[fadeIn_0.6s_ease-out_0.3s_both]">
          <div className="space-y-3">
            {/* Google */}
            <SocialButton
              icon={<GoogleIcon />}
              label="Continue with Google"
              variant="outline"
              className="h-[54px] border-black/10 bg-white text-[#1c1330] shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset,0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-[1px] hover:border-accent/40 hover:bg-white hover:shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset,0_6px_16px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              loading={loadingProvider === "google"}
              disabled={
                loadingProvider !== null &&
                loadingProvider !== "google"
              }
              onClick={() =>
                handleOAuth("google")
              }
            />

            {/* Facebook */}
            <div className="group relative rounded-xl">
              <div
                aria-hidden
                className="absolute -inset-[1.5px] rounded-xl bg-gradient-to-r from-accent via-accent-hot to-accent opacity-0 blur-[6px] transition-opacity duration-300 group-hover:opacity-70"
                style={{ backgroundSize: "200% auto" }}
              />

              <SocialButton
                icon={<FacebookIcon color="#fff" />}
                label="Continue with Facebook"
                variant="solid"
                className="relative h-[54px] shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_2px_8px_rgba(217,40,150,0.25)] transition-all duration-200 group-hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-hot focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                loading={loadingProvider === "facebook"}
                disabled={
                  loadingProvider !== null &&
                  loadingProvider !== "facebook"
                }
                onClick={() =>
                  handleOAuth("facebook")
                }
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted/60">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
            </div>

            {/* Email */}
            <a
              href="/auth/email"
              className="group flex h-[54px] w-full items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface-raised/60 px-5 text-sm font-medium text-ink shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-[1px] hover:border-accent/40 hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Mail className="h-[19px] w-[19px] text-accent transition-colors group-hover:text-accent-hot" />

              <span>
                Continue with email
              </span>
            </a>
          </div>
        </section>

        {/* Signup */}
        <p className="mt-6 text-sm text-ink-muted animate-[fadeIn_0.6s_ease-out_0.4s_both]">
          New here?{" "}
          <a
            href="/auth/signup"
            className="font-medium text-ink underline decoration-ink/20 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent/40"
          >
            Create an account
          </a>
        </p>

        {/* Terms */}
        <div className="mt-5 flex w-full items-start gap-2.5 px-2 text-left sm:px-4 animate-[fadeIn_0.6s_ease-out_0.5s_both]">
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

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes breathe {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes shadowPulse {
          0%,
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.3;
          }

          50% {
            transform: translateX(-50%) scale(0.85);
            opacity: 0.18;
          }
        }

        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes gradientShift {
          0%,
          100% {
            background-position: 0% center;
          }

          50% {
            background-position: 100% center;
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.06;
          }

          50% {
            opacity: 0.12;
          }
        }
      `}</style>
    </main>
  );
}