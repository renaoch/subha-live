"use client";

/**
 * Bridges native Capacitor behavior into the web app. Safe to import from
 * anywhere — every call is a no-op when running in a normal browser tab,
 * since @capacitor/core resolves to a web fallback implementation there.
 *
 * Wire this up once near the root of the app, e.g. in a client component
 * inside app/layout.tsx:
 *
 *   useEffect(() => { initNativeBridge(); }, []);
 */
export async function initNativeBridge() {
  if (typeof window === "undefined") return;

  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const [{ App }, { StatusBar, Style }, { SplashScreen }] =
    await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);

  // Match the app's dark theme and hide the splash once React has painted.
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#0B0B0F" }).catch(() => {});
  SplashScreen.hide().catch(() => {});

  // Android hardware back button: go back in WebView history first,
  // only exit the app once there's nowhere left to go back to.
  App.addListener("backButton", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Re-check auth/session state and live connections when the app
  // returns from the background (e.g. after a call or notification).
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      window.dispatchEvent(new CustomEvent("subha:app-resumed"));
    } else {
      window.dispatchEvent(new CustomEvent("subha:app-paused"));
    }
  });
}

export async function isNativeApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}
