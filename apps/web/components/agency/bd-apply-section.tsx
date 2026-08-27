"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Loader2,
  Clock3,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { bdApi, type BdApplication } from "@/lib/api/bd";

export function BdApplySection() {
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<BdApplication | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [agencyExperience, setAgencyExperience] = useState("");
  const [monthlyTargetUsd, setMonthlyTargetUsd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const application = await bdApi.me();
        if (!cancelled) setExisting(application);
      } catch {
        // no application yet / not fatal
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!contactNumber.trim()) {
      setFormError("Contact number is required.");
      return;
    }

    setSubmitting(true);
    try {
      const application = await bdApi.apply({
        fullName: fullName.trim(),
        contactNumber: contactNumber.trim(),
        agencyExperience: agencyExperience.trim() || undefined,
        monthlyTargetUsd: monthlyTargetUsd
          ? Number(monthlyTargetUsd)
          : undefined,
      });
      setExisting(application);
      setOpen(false);
      toast.success("Application submitted!", {
        description: "We'll review your request to become an agency owner.",
      });
    } catch (err: any) {
      toast.error("Could not submit application", {
        description: err?.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return null;
  }

  // Already applied — show status instead of the form.
  if (existing && existing.status !== "rejected") {
    return (
      <section className="mt-4 w-full animate-[fadeIn_0.6s_ease-out_0.35s_both]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
          <Clock3 className="h-4 w-4 shrink-0 text-amber-300/60" />
          <p className="text-xs leading-relaxed text-ink-muted/70">
            Your agency-owner application is{" "}
            <span className="font-bold text-ink">
              {existing.status === "pending" ? "pending review" : existing.status}
            </span>
            . We'll notify you once it's reviewed.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 w-full animate-[fadeIn_0.6s_ease-out_0.35s_both]">
      {existing?.status === "rejected" && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-2.5">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-300/50" />
          <p className="text-[10.5px] leading-relaxed text-red-200/60">
            Your previous application was rejected. You may apply again below.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left backdrop-blur-xl transition hover:bg-white/[0.05]"
      >
        <span className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-ink">
            Apply to open your agency
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-ink-muted/50" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted/50" />
        )}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl"
        >
          <div>
            <label
              htmlFor="bd-full-name"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted/60"
            >
              Full name
            </label>
            <input
              id="bd-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              placeholder="Your full legal name"
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm font-medium text-ink outline-none transition placeholder:text-ink-muted/30 focus:border-accent/40 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="bd-contact"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted/60"
            >
              Contact number
            </label>
            <input
              id="bd-contact"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              disabled={submitting}
              placeholder="e.g. +91 98765 43210"
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm font-medium text-ink outline-none transition placeholder:text-ink-muted/30 focus:border-accent/40 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="bd-experience"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted/60"
            >
              Agency / talent experience (optional)
            </label>
            <textarea
              id="bd-experience"
              value={agencyExperience}
              onChange={(e) => setAgencyExperience(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Tell us about your experience running an agency or managing hosts"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition placeholder:text-ink-muted/30 focus:border-accent/40 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="bd-target"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted/60"
            >
              Monthly target (USD, optional)
            </label>
            <input
              id="bd-target"
              type="number"
              min={0}
              value={monthlyTargetUsd}
              onChange={(e) => setMonthlyTargetUsd(e.target.value)}
              disabled={submitting}
              placeholder="10000"
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-sm font-medium text-ink outline-none transition placeholder:text-ink-muted/30 focus:border-accent/40 disabled:opacity-50"
            />
          </div>

          {formError && (
            <p className="text-xs text-red-300/70">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-black transition hover:bg-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit application"
            )}
          </button>
        </form>
      )}
    </section>
  );
}