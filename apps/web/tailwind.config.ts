import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        ink: "hsl(var(--ink))",
        "ink-muted": "hsl(var(--ink-muted))",
        border: "hsl(var(--border))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          hot: "hsl(var(--accent-hot))",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "playhouses-gradient":
          "linear-gradient(160deg, hsl(var(--grad-start)) 0%, hsl(var(--grad-mid)) 55%, hsl(var(--grad-end)) 100%)",
      },
      boxShadow: {
        panel: "0 24px 60px -20px hsl(var(--shadow-color) / 0.55)",
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
      },
      animation: {
        "float-slow": "float-slow 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "chat-in-left": "chat-in-left 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "chat-in-right": "chat-in-right 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
      },
    },
  },
  plugins: [],
};

export default config;