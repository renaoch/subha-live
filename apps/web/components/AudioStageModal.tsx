// components/AudioStageModal.tsx
import { X, Loader2, Check, Mic } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import type { SpeakerRequest } from '@/lib/api/rooms';

interface SpeakerInfo {
  userId: string;
  sessionId: string;
  audioTrackName: string;
  videoTrackName?: string;
  hasVideo?: boolean;
}

interface AudioStageModalProps {
  isHost: boolean;
  requests: SpeakerRequest[];
  speakers: SpeakerInfo[];
  speakerProfiles?: Record<string, { name: string; avatar: string | null }>;
  speakingSpeakerIds?: Set<string>;
  seatCount: number;
  pending: boolean;
  requestLoading: boolean;
  onRequest: () => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onClose: () => void;
  hostName: string;
}

export function AudioStageModal({
  isHost,
  requests,
  speakers,
  speakerProfiles = {},
  speakingSpeakerIds,
  seatCount,
  pending,
  requestLoading,
  onRequest,
  onApprove,
  onReject,
  onClose,
  hostName,
}: AudioStageModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-4 pb-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-[#141418] to-[#0a0a0c] shadow-[0_-8px_60px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-6 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient top glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-40 w-[280px] -translate-x-1/2 rounded-full bg-[#FF3B5C]/[0.10] blur-3xl" />

        <div className="flex justify-center pt-3">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Close audio stage"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex max-h-[75dvh] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3B5C]/15">
                <Mic className="h-2.5 w-2.5 text-[#FF3B5C]" strokeWidth={2.4} />
              </span>
              <p className="text-[13px] font-bold tracking-tight text-white">Audio stage</p>
            </div>
            <p className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/50">
              {speakers.length}/{seatCount} seats
            </p>
          </div>

          {/* Seats */}
          <div className="flex items-start gap-2 px-5 pb-5">
            {Array.from({ length: seatCount }).map((_, index) => {
              const speaker = speakers[index];
              const profile = speaker ? speakerProfiles[speaker.userId] : undefined;
              const name = profile?.name || (speaker ? `Guest ${index + 1}` : 'Open');
              const speaking = speaker ? speakingSpeakerIds?.has(speaker.userId) : false;

              return (
                <div
                  key={speaker?.userId ?? `empty-${index}`}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    {speaker ? (
                      <>
                        {speaking && (
                          <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-[#FF3B5C]/20" />
                        )}
                        <div
                          className={`absolute inset-0 rounded-full transition-all duration-200 ${
                            speaking
                              ? 'bg-gradient-to-tr from-[#FF3B5C] via-[#FF8A5B] to-[#FFD36E] opacity-100'
                              : 'opacity-0'
                          }`}
                          style={{ padding: 2 }}
                        >
                          <div className="h-full w-full rounded-full bg-[#0a0a0c]" />
                        </div>
                        <Avatar
                          name={name}
                          src={profile?.avatar ?? undefined}
                          size="sm"
                          className={`relative h-11 w-11 border-2 transition-transform duration-150 ${
                            speaking ? 'scale-[1.06] border-transparent' : 'border-white/15'
                          }`}
                        />
                      </>
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/[0.14] bg-white/[0.02]">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`max-w-full truncate text-[10px] font-medium ${
                      speaker ? 'text-white/70' : 'text-white/25'
                    }`}
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

          {/* Host: request list */}
          {isHost ? (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04]">
                    <Mic className="h-4 w-4 text-white/20" strokeWidth={1.75} />
                  </div>
                  <p className="text-[11px] text-white/25">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">
                    Requests to speak · {requests.length}
                  </p>
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-2 rounded-2xl px-2 py-2 transition hover:bg-white/[0.04]"
                    >
                      <div className="relative">
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0c0c0f] bg-[#FF3B5C]" />
                        <Avatar
                          name={request.user?.name || 'Viewer'}
                          src={request.user?.avatar ?? undefined}
                          size="sm"
                        />
                      </div>
                      <p className="flex-1 truncate text-[12.5px] font-medium text-white/85">
                        {request.user?.name || 'Viewer'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onReject(request.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.08] hover:text-white active:scale-90"
                        aria-label="Decline request"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onApprove(request.id)}
                        disabled={speakers.length >= seatCount}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/20 active:scale-90 disabled:opacity-30"
                        aria-label="Accept request"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4">
              {pending ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] py-3.5 text-[12.5px] font-medium text-white/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Waiting for {hostName} to approve
                </div>
              ) : speakers.length >= seatCount ? (
                <p className="py-3 text-center text-[12.5px] text-white/25">Stage is full</p>
              ) : (
                <button
                  type="button"
                  onClick={onRequest}
                  disabled={requestLoading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF3B5C] to-[#FF6B4A] py-3.5 text-[13px] font-bold text-white shadow-[0_4px_24px_rgba(255,59,92,0.35)] transition active:scale-[0.98] disabled:opacity-40"
                >
                  <Mic className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Request to speak
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}