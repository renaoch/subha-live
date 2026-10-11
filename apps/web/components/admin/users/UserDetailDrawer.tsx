"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Ban, Loader2, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { adminUsersApi, type AdminUserDetail, type BanInput } from "@/lib/api/admin-users";
import { UserAvatar } from "@/components/admin/users/UserAvatar";
import { BanDialog } from "@/components/admin/users/BanDialog";
import { StatusBadge, UserBadges, fmtDate, fmtDay, num } from "@/components/admin/users/shared";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9088A0]">{title}</h4>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function Field({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-white/[0.04] px-3 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10.5px] uppercase tracking-wide text-[#6f6683]">{label}</p>
      <p className="mt-0.5 break-words text-[13.5px] font-medium text-[#F3ECE0]">{value || "—"}</p>
    </div>
  );
}

export function UserDetailDrawer({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifting, setLifting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminUsersApi.detail(userId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [userId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  async function ban(input: BanInput) {
    setSaving(true);
    try {
      await adminUsersApi.ban(userId, input);
      toast.success("User banned");
      setBanOpen(false);
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to ban user");
    } finally {
      setSaving(false);
    }
  }

  async function lift() {
    setLifting(true);
    try {
      await adminUsersApi.unban(userId);
      toast.success("Ban lifted — the user has access again");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to lift ban");
    } finally {
      setLifting(false);
    }
  }

  const u = data?.user;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[480px] flex-col border-l border-[#2A2238] bg-[#120e1b] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2A2238] px-5 py-3.5">
          <h3 className="text-[14px] font-semibold text-[#F3ECE0]">User details</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#9088A0] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!data && !failed && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#9088A0]" />
          </div>
        )}
        {failed && <p className="p-8 text-center text-sm text-[#9088A0]">Couldn&apos;t load this user.</p>}

        {data && u && (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="flex items-center gap-4">
                <UserAvatar name={u.name} src={u.avatar} size={76} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[18px] font-bold text-[#F3ECE0]">{u.name}</p>
                    <UserBadges isAdmin={u.isAdmin} isVerified={u.isVerified} svip={u.svip} vipLevel={u.vipLevel} />
                  </div>
                  <p className="truncate text-[13px] text-[#9088A0]">@{u.handle}</p>
                  <div className="mt-1.5">
                    <StatusBadge ban={u.ban} />
                  </div>
                </div>
              </div>

              {u.ban && (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-red-300">
                    {u.ban.permanent ? "Permanent ban" : `Temporary ban — ends ${fmtDate(u.ban.until)}`}
                  </p>
                  <p className="mt-1.5 text-[13.5px] text-red-100/90">{u.ban.reason}</p>
                  <p className="mt-1.5 text-[11.5px] text-red-200/60">Since {fmtDate(u.ban.bannedAt)}</p>
                </div>
              )}

              {data.bio && <p className="rounded-xl bg-white/[0.04] p-3 text-[13px] italic text-[#C9C0D8]">&ldquo;{data.bio}&rdquo;</p>}

              <Section title="Identity">
                <Field label="User ID" value={<span className="font-mono text-[11.5px]">{u.id}</span>} wide />
                <Field label="Public ID" value={u.publicId} />
                <Field label="Role" value={u.role} />
                <Field label="Country" value={u.country ? `${u.countryFlag ?? ""} ${u.country}` : null} />
                <Field label="Gender" value={u.gender?.replace(/_/g, " ")} />
                <Field label="Joined" value={fmtDay(u.createdAt)} />
              </Section>

              <Section title="Account">
                <Field label="Email" value={data.account.email} wide />
                <Field label="Phone" value={data.account.phone} />
                <Field label="Email confirmed" value={data.account.emailConfirmed ? "Yes" : "No"} />
                <Field label="Sign-in method" value={data.account.provider} />
                <Field label="Last sign-in" value={fmtDate(data.account.lastSignInAt)} />
              </Section>

              <Section title="Levels">
                <Field label="Level" value={u.level} />
                <Field label="Charisma level" value={u.charismaLevel} />
                <Field label="VIP level" value={u.vipLevel} />
                <Field label="SVIP" value={u.svip ? "Yes" : "No"} />
              </Section>

              <Section title="Wallet & activity">
                <Field label="Coins" value={num(u.coins)} />
                <Field label="Diamonds" value={num(u.diamonds)} />
                <Field label="Coins spent on gifts" value={num(data.stats.coinsSpent)} />
                <Field label="Diamonds earned" value={num(data.stats.diamondsEarned)} />
                <Field label="Gifts sent" value={num(data.stats.giftsSent)} />
                <Field label="Gifts received" value={num(data.stats.giftsReceived)} />
                <Field label="Lives hosted" value={num(data.stats.roomsHosted)} />
              </Section>

              <Section title="Social">
                <Field label="Followers" value={num(u.followers)} />
                <Field label="Following" value={num(u.following)} />
              </Section>

              {data.agencies.length > 0 && (
                <Section title="Agency">
                  {data.agencies.map((a) => (
                    <Field key={a.agencyId} label={`Agency · ${a.status ?? "—"}`} value={<span className="font-mono text-[11.5px]">{a.agencyId}</span>} wide />
                  ))}
                </Section>
              )}

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9088A0]">Ban history</h4>
                {data.banHistory.length === 0 ? (
                  <p className="rounded-xl bg-white/[0.04] px-3 py-3 text-[12.5px] text-[#6f6683]">No bans on record.</p>
                ) : (
                  <div className="space-y-2">
                    {data.banHistory.map((b) => (
                      <div key={b.id} className="rounded-xl bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold text-[#F3ECE0]">
                            {b.permanent ? "Permanent" : `Until ${fmtDate(b.until)}`}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              b.status === "active" ? "bg-red-500/20 text-red-300" : b.status === "lifted" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/45"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[#C9C0D8]">{b.reason}</p>
                        <p className="mt-1 text-[11px] text-[#6f6683]">
                          {fmtDate(b.bannedAt)}
                          {b.bannedBy ? ` · by ${b.bannedBy}` : ""}
                          {b.revokedAt ? ` · lifted ${fmtDate(b.revokedAt)}${b.revokedBy ? ` by ${b.revokedBy}` : ""}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="border-t border-[#2A2238] px-5 py-4">
              {u.isAdmin ? (
                <p className="text-center text-[12px] text-[#6f6683]">Admin accounts can&apos;t be banned.</p>
              ) : u.ban ? (
                <button
                  type="button"
                  onClick={() => void lift()}
                  disabled={lifting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-[13px] font-bold text-white transition hover:bg-emerald-500/90 disabled:opacity-60"
                >
                  {lifting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} Lift ban
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBanOpen(true)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-red-500 text-[13px] font-bold text-white transition hover:bg-red-500/90"
                >
                  <Ban className="h-4 w-4" /> Ban user
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      {banOpen && u && <BanDialog user={u} saving={saving} onClose={() => setBanOpen(false)} onConfirm={(i) => void ban(i)} />}
    </div>
  );
}
