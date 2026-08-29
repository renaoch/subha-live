# Subha — Native App Shell (Capacitor)

This wraps the deployed Subha web app (`https://subha.fun`) in a native
Android/iOS shell using Capacitor. It is **not** a static bundle — the app
loads your live production site inside a WebView, because the web app uses
Next.js middleware, server components, and API routes (Supabase auth,
WebRTC signaling) that can't be statically exported.

## What's configured

- `capacitor.config.ts` → loads `https://subha.fun`, allows navigation to
  Supabase/OAuth domains for login redirects.
- **Android**: camera/mic/network permissions in `AndroidManifest.xml`,
  plus a `MainActivity.java` that requests runtime permissions and bridges
  them into the WebView's `getUserMedia()` prompts (required for WebRTC —
  without this, camera/mic access silently fails in the embedded WebView).
- **iOS**: `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` in
  `Info.plist` (WKWebView auto-prompts for `getUserMedia` once these
  strings exist — no extra delegate code needed on iOS 15+).
- App icon + splash screen generated from `apps/web/app/icon.png`.
- `apps/web/lib/capacitor/native.ts` + `NativeBridge` component (already
  wired into `app/layout.tsx`): handles Android back-button, status bar
  color, splash dismissal, and app-resume events. No-ops in a normal
  browser tab.

## One-time setup

```bash
cd apps/mobile
npm install
```

The `android/` and `ios/` folders are already generated and committed.
You don't need to run `cap add` again unless you delete them.

## Building

**Android** (requires Android Studio + JDK 17):
```bash
npx cap open android
# Build > Build Bundle(s)/APK(s) > Build APK(s), or Run ▶ on a device
```

**iOS** (requires Xcode + CocoaPods, macOS only):
```bash
cd ios/App && pod install && cd ../..
npx cap open ios
# Select a signing team in Xcode, then Run ▶
```

## Whenever you change capacitor.config.ts or add a plugin

```bash
npx cap sync
```

This copies the updated config into both native projects. It does **not**
rebuild your web app — since this app loads from a live URL, just deploy
`apps/web` to Vercel as usual and the native app picks up changes on next
launch (no app-store resubmission needed for web-side changes).

## Testing against a local dev server instead of production

Edit `capacitor.config.ts`:
```ts
server: {
  url: "http://10.0.2.2:3000", // Android emulator's alias for host localhost
  cleartext: true,
}
```
(iOS simulator can use `http://localhost:3000` directly.) Run `npx cap sync`
after changing this, and revert to `https://subha.fun` before shipping —
`cleartext: true` should never ship to production.

## Known follow-ups

- **App Links / Universal Links**: the Android manifest has a `subha.fun`
  intent-filter scaffolded but `autoVerify` is off because no
  `https://subha.fun/.well-known/assetlinks.json` is hosted yet. Same for
  iOS Associated Domains — add these later if you want links tapped
  outside the app (email, SMS) to open the native app directly instead of
  a browser.
- **Push notifications**: `@capacitor/push-notifications` is installed but
  not wired to a backend (FCM/APNs credentials) — add when ready.
- Auth (OAuth + email) works via the existing `/auth/callback` server
  route since it's a normal same-origin HTTPS redirect — no custom URL
  scheme needed, it happens entirely inside the WebView.
