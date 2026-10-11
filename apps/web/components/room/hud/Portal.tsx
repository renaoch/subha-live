"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children straight into <body>. Sheets opened from inside the room
 * header must use this: the header is its own stacking context (z-30), so a
 * `fixed z-[60]` sheet inside it can never rise above the chat / bottom bar
 * that live in a later z-30 layer. In <body> it sits above everything.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}