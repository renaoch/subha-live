"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";

export default function EmailAuthPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [loading, setLoading] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "signin"
        ? await authApi.signInWithPassword(email.trim(), password)
        : await authApi.signUp(email.trim(), password);
      if (result.error) throw result.error;
      if (mode === "signup") {
        toast.success("Account created. Check your email if confirmation is enabled.");
        setMode("signin");
      } else {
        window.location.assign("/home");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-Subha-gradient px-6 py-10 text-ink">
      <section className="glow-hot-lg glass-panel w-full max-w-md rounded-[28px] p-7 sm:p-9">
        <Link href="/auth" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-accent-hot">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <div className="mb-8">
          <div className="grad-brand mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white glow-hot"><Mail className="h-6 w-6" /></div>
          <h1 className="font-display text-3xl font-black">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Use your email and password to continue to Subha.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-surface-raised px-4 outline-none transition focus:border-accent-hot/50" autoComplete="email" /></label>
          <label className="block text-sm font-medium">Password<input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-surface-raised px-4 outline-none transition focus:border-accent-hot/50" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
          <button disabled={loading} className="grad-brand animate-gradient-shift glow-hot flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "signin" ? "Continue with email" : "Create account"}
          </button>
        </form>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-6 w-full text-center text-sm text-ink-muted transition hover:text-accent-hot">
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
