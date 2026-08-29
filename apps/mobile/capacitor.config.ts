import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fun.subha.app",
  appName: "Subha",
  webDir: "www",

  // This app is server-rendered (Next.js middleware + API routes for
  // Supabase auth and WebRTC signaling), so it can't ship as a static
  // bundle. Capacitor loads the live, deployed site directly inside the
  // native WebView shell instead of files from webDir.
  server: {
    url: "https://subha.fun",
    cleartext: false,
    // Let the WebView follow navigation to auth/OAuth redirect domains
    // (Supabase, Google, Facebook) without Capacitor blocking them.
    allowNavigation: [
      "subha.fun",
      "*.subha.fun",
      "*.supabase.co",
      "accounts.google.com",
      "*.googleusercontent.com",
      "facebook.com",
      "*.facebook.com",
      "platform-lookaside.fbsbx.com",
    ],
  },

  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
  },

  ios: {
    contentInset: "always",
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0B0B0F",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0B0B0F",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
