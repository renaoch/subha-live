// components/AudioStageModal.tsx
import { X, UserRound, Loader2, Mic } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import type { SpeakerRequest } from '@/lib/api/rooms';

interface AudioStageModalProps {
  isHost: boolean;
  requests: SpeakerRequest[];
  speakers: Array<{
    userId: string;
    sessionId: string;
    audioTrackName: string;
    videoTrackName?: string;
    hasVideo?: boolean;
  }>;
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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-4 pb-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[390px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0c0f] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/5 hover:text-white"
          aria-label="Close audio stage"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex max-h-[75dvh] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <p className="text-[8px] font-semibold text-white">Audio stage</p>
            <p className="text-[8px] text-white/35">
              {speakers.length}/{seatCount}
            </p>
          </div>

          {/* Seats */}
          <div className="flex items-center gap-1.5 px-5 pb-5">
            {Array.from({ length: seatCount }).map((_, index) => {
              const speaker = speakers[index];
              return (
                <div
                  key={speaker?.userId ?? `empty-${index}`}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      speaker
                        ? 'bg-white/[0.08] ring-1 ring-white/15'
                        : 'border border-dashed border-white/10'
                    }`}
                  >
                    {speaker ? (
                      <UserRound className="h-4.5 w-4.5 text-white/60" strokeWidth={1.75} />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    )}
                  </div>
                  <span className="truncate text-[10px] font-medium text-white/35">
                    {speaker ? `Guest ${index + 1}` : 'Open'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Host: request list */}
          {isHost ? (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {requests.length === 0 ? (
                <p className="py-6 text-center text-[8px] text-white/25">No pending requests</p>
              ) : (
                <div className="space-y-1">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-1.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
                    >
                      <Avatar
                        name={request.user?.name || 'Viewer'}
                        src={request.user?.avatar ?? undefined}
                        size="sm"
                      />
                      <p className="flex-1 truncate text-[12px] font-medium text-white/75">
                        {request.user?.name || 'Viewer'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onReject(request.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white"
                        aria-label="Decline request"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onApprove(request.id)}
                        disabled={speakers.length >= seatCount}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-30"
                        aria-label="Accept request"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4">
              {pending ? (
                <div className="flex items-center justify-center gap-1 rounded-xl py-3 text-[12px] text-white/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Waiting for the host
                </div>
              ) : speakers.length >= seatCount ? (
                <p className="py-3 text-center text-[12px] text-white/25">Stage is full</p>
              ) : (
                <button
                  type="button"
                  onClick={onRequest}
                  disabled={requestLoading}
                  className="flex w-full items-center justify-center gap-1 rounded-full bg-white py-3 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
                >
                  <Mic className="h-3.5 w-3.5" />
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