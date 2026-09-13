import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        "surface-overlay": "hsl(var(--surface-overlay))",
        ink: "hsl(var(--ink))",
        "ink-muted": "hsl(var(--ink-muted))",
        "ink-faint": "hsl(var(--ink-faint))",
        border: "hsl(var(--border))",
        live: "hsl(var(--live-red))",
        accent: {
          DEFAULT: "hsl(var(--accent-hot))",
          hot: "hsl(var(--accent-hot))",
          hot2: "hsl(var(--accent-hot-2))",
          violet: "hsl(var(--accent-violet))",
          cyan: "hsl(var(--accent-cyan))",
          gold: "hsl(var(--accent-gold))",
          green: "hsl(var(--accent-green))",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "playhouses-gradient":
          "linear-gradient(160deg, hsl(var(--grad-start)) 0%, hsl(var(--grad-mid)) 55%, hsl(var(--grad-end)) 100%)",
        "brand-radial":
          "radial-gradient(120% 120% at 20% -10%, hsl(var(--accent-hot) / 0.35), transparent 55%), radial-gradient(120% 120% at 90% 0%, hsl(var(--accent-violet) / 0.3), transparent 50%)",
      },
      boxShadow: {
        panel: "0 24px 60px -20px hsl(var(--shadow-color) / 0.55)",
        glow: "0 8px 30px -8px hsl(var(--shadow-color) / 0.65)",
        "glow-lg":
          "0 0 0 1px hsl(var(--accent-hot) / 0.25), 0 20px 60px -15px hsl(var(--shadow-color) / 0.7)",
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "chat-in-left": {
          "0%": { transform: "translateY(8px) scale(0.92)", opacity: "0" },
          "60%": { transform: "translateY(-1px) scale(1.01)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "chat-in-right": {
          "0%": { transform: "translateY(8px) scale(0.92)", opacity: "0" },
          "60%": { transform: "translateY(-1px) scale(1.01)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "live-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--accent-hot) / 0.55)" },
          "70%": { boxShadow: "0 0 0 14px hsl(var(--accent-hot) / 0)" },
        },
        "sparkle-spin": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.15)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "float-slow": "float-slow 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "chat-in-left": "chat-in-left 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "chat-in-right": "chat-in-right 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "live-dot": "live-dot 1.4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "sparkle-spin": "sparkle-spin 3.5s ease-in-out infinite",
        marquee: "marquee 14s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
