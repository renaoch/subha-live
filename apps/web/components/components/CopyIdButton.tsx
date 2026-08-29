"use client";

import { useState, useCallback } from "react";

/**
 * Small, isolated client component. Keeping this as the only "use client"
 * boundary on the page means the rest of the profile ships as zero-JS
 * server-rendered markup — the interactive surface area (and hydration
 * cost) is limited to exactly the one button that needs it.
 */
export function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    } catch {
      // Clipboard API can fail (permissions, insecure context) —
      // fail silently rather than throwing in the UI.
    }
  }, [id]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "ID copied" : "Copy ID to clipboard"}
      className="rounded-full p-1 text-[#9088A0] transition-colors hover:text-[#CBA35C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBA35C]"
    >
      {copied ? (
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M4 10.5 8 14l8-8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <rect
            x="6.5"
            y="6.5"
            width="9"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M4.5 12.5v-6a2 2 0 0 1 2-2h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}