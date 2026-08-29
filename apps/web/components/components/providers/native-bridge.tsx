"use client";

import { useEffect } from "react";
import { initNativeBridge } from "@/lib/capacitor/native";

/**
 * Activates Capacitor's native behaviors (status bar theming, splash
 * screen dismissal, Android back-button handling, app-resume events)
 * when this app is running inside the Subha native app shell. Renders
 * nothing and is a complete no-op in a normal browser tab.
 */
export function NativeBridge() {
  useEffect(() => {
    initNativeBridge();
  }, []);

  return null;
}
