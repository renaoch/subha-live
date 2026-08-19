"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      setEmail(user.email ?? null);
      setLoading(false);
    }

    loadUser();
  }, [router]);

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#08080b]">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/20 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex flex-col items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
            <Sparkles className="h-5 w-5 animate-pulse text-purple-300" />
          </div>

          <p className="text-sm text-white/50">Loading your space...</p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#08080b] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -40, 60, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-purple-600/20 blur-[130px]"
        />

        <motion.div
          animate={{
            x: [0, -80, 40, 0],
            y: [0, 50, -60, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[5%] right-[5%] h-[380px] w-[380px] rounded-full bg-indigo-500/15 blur-[130px]"
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#08080b_75%)]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Subha
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-xl">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>

          <span className="text-xs text-white/50">Online</span>
        </div>
      </motion.header>

      {/* Main */}
      <section className="relative z-10 flex min-h-[calc(100dvh-88px)] items-center justify-center px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="w-full max-w-3xl"
        >
          {/* Welcome card */}
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl md:p-12">
            {/* Card glow */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-500/15 blur-[80px]" />

            <div className="relative">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Authentication successful
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl"
              >
                Welcome to{" "}
                <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                  Subha
                </span>
                .
              </motion.h1>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mt-5 max-w-xl text-base leading-7 text-white/45 md:text-lg"
              >
                Your account is ready. Everything is set up and you're
                successfully signed in.
              </motion.p>

              {/* User */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-sm font-semibold uppercase shadow-lg shadow-purple-500/20">
                    {email?.charAt(0) ?? "U"}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs text-white/35">
                      Signed in as
                    </p>

                    <p className="truncate text-sm font-medium text-white/80">
                      {email}
                    </p>
                  </div>
                </div>

                <div className="hidden shrink-0 items-center gap-2 text-xs text-emerald-400 sm:flex">
                  <CheckCircle2 className="h-4 w-4" />
                  Verified
                </div>
              </motion.div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-medium text-black shadow-xl shadow-white/5 transition-all hover:bg-white/90"
              >
                Continue to Subha
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>
            </div>
          </div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-white/20"
          >
            Securely authenticated with Supabase
          </motion.p>
        </motion.div>
      </section>
    </main>
  );
}