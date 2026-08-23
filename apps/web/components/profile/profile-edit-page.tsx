"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Loader2,
  Check,
  User as UserIcon,
  Camera,
  ChevronRight,
  AtSign,
  MapPin,
  AlertCircle,
} from "lucide-react";

import { usersApi, type UpdateProfileInput } from "@/lib/api/users";
import { uploadAvatar, AvatarUploadError } from "@/lib/supabase/avatar-upload";
import { flagFromCode, type Country } from "@/lib/data/countries";
import { CountryPicker } from "@/components/profile/country-picker";
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
  "mt-1 w-full rounded-lg border border-[#2A2238] bg-[#17131F] px-3 py-2.5 text-sm text-[#F3ECE0] placeholder:text-[#9088A0]/50 transition-colors focus:border-[#CBA35C]/50 focus:outline-none";

interface FieldProps {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, icon, error, hint, children }: FieldProps) {
  return (
    <div className="rounded-2xl border border-[#2A2238] bg-[#1D1829]/60 p-4 transition-colors focus-within:border-[#3A3050]">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#9088A0]">
          {icon}
          {label}
        </label>
        {hint && (
          <span className="text-[10px] text-[#9088A0]/60">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function ProfileEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

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

  function handleSelectCountry(country: Country) {
    updateField("country", country.name);
    updateField("country_flag", flagFromCode(country.code));
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !profile) return;

    setAvatarError(null);
    setUploadingAvatar(true);

    try {
      const url = await uploadAvatar(file, profile.id);
      updateField("avatar", url);
    } catch (err) {
      setAvatarError(
        err instanceof AvatarUploadError
          ? err.message
          : "Failed to upload avatar. Please try again.",
      );
    } finally {
      setUploadingAvatar(false);
    }
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
      setTimeout(() => router.push("/profile"), 500);
      return;
    }

    try {
      await usersApi.updateMe(payload);

      setSaved(true);
      // Give the "Saved" state a beat to register, then head back to the
      // profile so the person sees their changes reflected immediately.
      setTimeout(() => router.push("/profile"), 600);
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
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#17131F] text-[#F3ECE0]">
        <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-6">
          <div className="h-9 w-full animate-pulse rounded-xl bg-[#1D1829]" />
          <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-[#1D1829]" />
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
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-[#2A2238]/80 bg-[#17131F]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CBA35C]/70">
              Profile
            </p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight">
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
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-32 pt-6">
        <form
          id="profile-edit-form"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Avatar — centered hero style */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-[#2A2238] bg-[#2A2238] shadow-[0_0_0_4px_rgba(203,163,92,0.08)]">
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
                    <UserIcon className="h-9 w-9" />
                  </div>
                )}

                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="h-6 w-6 animate-spin text-[#CBA35C]" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change avatar"
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#17131F] bg-[#CBA35C] text-[#17131F] shadow-md transition-transform duration-150 hover:bg-[#DBB870] active:scale-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-xs font-semibold text-[#CBA35C] transition-colors hover:text-[#DBB870] disabled:opacity-60"
            >
              {uploadingAvatar ? "Uploading..." : "Change photo"}
            </button>

            {avatarError && (
              <p className="flex items-center gap-1 text-xs text-rose-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {avatarError}
              </p>
            )}
          </div>

          {/* Name */}
          <Field label="Name" icon={<UserIcon className="h-3 w-3" />} error={fieldErrors.name}>
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
          <Field label="Handle" icon={<AtSign className="h-3 w-3" />} error={fieldErrors.handle}>
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

          {/* Country — opens picker, flag is derived automatically */}
          <Field label="Country" icon={<MapPin className="h-3 w-3" />} error={fieldErrors.country}>
            <button
              type="button"
              onClick={() => setCountryPickerOpen(true)}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg border border-[#2A2238] bg-[#17131F] px-3 py-2.5 text-left transition-colors hover:border-[#3A3050]"
            >
              {form.country_flag ? (
                <span className="text-lg leading-none">
                  {form.country_flag}
                </span>
              ) : (
                <MapPin className="h-4 w-4 text-[#9088A0]" />
              )}
              <span
                className={`flex-1 text-sm ${
                  form.country ? "text-[#F3ECE0]" : "text-[#9088A0]/50"
                }`}
              >
                {form.country || "Select your country"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#9088A0]" />
            </button>
          </Field>

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
              <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {fieldErrors.gender}
              </p>
            )}
          </div>

          {saveError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
        </form>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#2A2238]/80 bg-[#17131F]/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <button
            type="submit"
            form="profile-edit-form"
            disabled={saving || uploadingAvatar}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CBA35C] py-3.5 text-sm font-black uppercase tracking-wider text-[#17131F] shadow-[0_8px_24px_-8px_rgba(203,163,92,0.5)] transition-all duration-200 hover:bg-[#DBB870] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      </div>

      <CountryPicker
        open={countryPickerOpen}
        value={form.country}
        onClose={() => setCountryPickerOpen(false)}
        onSelect={handleSelectCountry}
      />
    </main>
  );
}
