"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Check, User as UserIcon } from "lucide-react";

import { usersApi, type UpdateProfileInput } from "@/lib/api/users";
import type { PrivateProfile } from "@/lib/types";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

interface FormState {
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  country: string;
  country_flag: string;
  gender: string | null;
}

function toFormState(profile: PrivateProfile): FormState {
  return {
    name: profile.name ?? "",
    handle: profile.handle ?? "",
    avatar: profile.avatar ?? "",
    bio: profile.bio ?? "",
    country: profile.country ?? "",
    country_flag: profile.country_flag ?? "",
    gender: profile.gender ?? null,
  };
}

const inputClass =
  "mt-1 w-full rounded-lg border border-[#2A2238] bg-[#17131F] px-3 py-2.5 text-sm text-[#F3ECE0] placeholder:text-[#9088A0]/50 focus:border-[#CBA35C]/50 focus:outline-none";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, error, hint, children }: FieldProps) {
  return (
    <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#9088A0]">{label}</label>
        {hint && (
          <span className="text-[10px] text-[#9088A0]/60">{hint}</span>
        )}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function ProfileEditPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError(null);

        const user = await usersApi.me();

        if (!cancelled) {
          setProfile(user);
          setForm(toFormState(user));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load profile.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!profile || !form) return;

    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setSaved(false);

    // Only send fields that actually changed. Every field on the backend
    // schema is optional, so a partial payload is exactly what it expects —
    // and it avoids accidentally clearing fields the user didn't touch.
    const payload: UpdateProfileInput = {};

    if (form.name.trim() !== (profile.name ?? "")) {
      payload.name = form.name.trim();
    }
    if (form.handle.trim() !== (profile.handle ?? "")) {
      payload.handle = form.handle.trim();
    }
    if (
      form.avatar.trim() !== (profile.avatar ?? "") &&
      form.avatar.trim() !== ""
    ) {
      payload.avatar = form.avatar.trim();
    }
    if (form.bio !== (profile.bio ?? "")) {
      payload.bio = form.bio;
    }
    if (form.country.trim() !== (profile.country ?? "")) {
      payload.country = form.country.trim();
    }
    if (form.country_flag.trim() !== (profile.country_flag ?? "")) {
      payload.country_flag = form.country_flag.trim();
    }
    if (form.gender !== (profile.gender ?? null)) {
      payload.gender = form.gender;
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return;
    }

    try {
      const updated = await usersApi.updateMe(payload);

      setProfile(updated);
      setForm(toFormState(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      // If your apiFetch surfaces the backend's `details` (field-level
      // errors from updateMyProfileSchema) on the thrown error, this
      // will map them onto the matching fields. Adjust the shape below
      // to match however apiFetch actually formats error bodies.
      const maybeDetails = (err as { details?: Record<string, string[]> } | undefined)
        ?.details;

      if (maybeDetails) {
        const flat: Record<string, string> = {};
        for (const [key, messages] of Object.entries(maybeDetails)) {
          if (messages?.[0]) flat[key] = messages[0];
        }
        setFieldErrors(flat);
      }

      setSaveError(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
        <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-6">
          <div className="h-9 w-full animate-pulse rounded-xl bg-[#1D1829]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[#1D1829]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-[#1D1829]"
            />
          ))}
        </div>
      </main>
    );
  }

  if (loadError || !profile || !form) {
    return (
      <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
        <div className="mx-auto max-w-md px-4 pb-10 pt-10">
          <div className="rounded-2xl border border-[#3A2634] bg-[#1D1829] p-5">
            <h1 className="text-lg font-semibold">Unable to load profile</h1>
            <p className="mt-2 text-sm leading-6 text-[#9088A0]">
              {loadError ?? "Something went wrong."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#17131F] font-[family-name:var(--font-body)] text-[#F3ECE0] antialiased">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-16 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CBA35C]/70">
              Profile
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Edit Profile
            </h1>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2A2238] bg-[#1D1829]/80 text-[#9088A0] transition-all duration-200 hover:border-[#CBA35C]/40 hover:text-[#CBA35C] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#2A2238] bg-[#2A2238]">
              {form.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.avatar}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#9088A0]">
                  <UserIcon className="h-6 w-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <label
                htmlFor="avatar"
                className="text-xs font-medium text-[#9088A0]"
              >
                Avatar URL
              </label>
              <input
                id="avatar"
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={form.avatar}
                onChange={(e) => updateField("avatar", e.target.value)}
                className={inputClass}
              />
              {fieldErrors.avatar && (
                <p className="mt-1 text-xs text-rose-400">
                  {fieldErrors.avatar}
                </p>
              )}
            </div>
          </div>

          {/* Name */}
          <Field label="Name" error={fieldErrors.name}>
            <input
              type="text"
              maxLength={50}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Your display name"
              className={inputClass}
            />
          </Field>

          {/* Handle */}
          <Field label="Handle" error={fieldErrors.handle}>
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-[#2A2238] bg-[#17131F] px-3 py-2.5">
              <span className="text-sm text-[#9088A0]">@</span>
              <input
                type="text"
                maxLength={30}
                value={form.handle}
                onChange={(e) =>
                  updateField(
                    "handle",
                    e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                  )
                }
                placeholder="username"
                className="w-full bg-transparent text-sm text-[#F3ECE0] placeholder:text-[#9088A0]/50 focus:outline-none"
              />
            </div>
          </Field>

          {/* Bio */}
          <Field
            label="Bio"
            error={fieldErrors.bio}
            hint={`${form.bio.length}/500`}
          >
            <textarea
              rows={4}
              maxLength={500}
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="Tell people a little about yourself..."
              className={`${inputClass} resize-none`}
            />
          </Field>

          {/* Country + flag */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Country" error={fieldErrors.country}>
                <input
                  type="text"
                  maxLength={100}
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  placeholder="India"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Flag" error={fieldErrors.country_flag}>
              <input
                type="text"
                maxLength={10}
                value={form.country_flag}
                onChange={(e) =>
                  updateField("country_flag", e.target.value)
                }
                placeholder="🇮🇳"
                className={`${inputClass} text-center text-lg`}
              />
            </Field>
          </div>

          {/* Gender */}
          <div>
            <p className="mb-2 text-xs font-medium text-[#9088A0]">Gender</p>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateField(
                      "gender",
                      form.gender === option.value ? null : option.value,
                    )
                  }
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    form.gender === option.value
                      ? "border-[#CBA35C]/50 bg-[#CBA35C]/10 text-[#CBA35C]"
                      : "border-[#2A2238] bg-[#1D1829]/60 text-[#9088A0] hover:border-[#3A3050]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {fieldErrors.gender && (
              <p className="mt-1 text-xs text-rose-400">
                {fieldErrors.gender}
              </p>
            )}
          </div>

          {saveError && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
              {saveError}
            </div>
          )}

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CBA35C] py-3.5 text-sm font-black uppercase tracking-wider text-[#17131F] transition-all duration-200 hover:bg-[#DBB870] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}