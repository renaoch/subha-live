"use client";

import type { LevelProgress } from "@/lib/api/levels";

import { getLevelTheme } from "./level-theme";

interface LevelHeroProps {
  progress: LevelProgress;
}

function Crown({
  type,
}: {
  type:
    | "none"
    | "small"
    | "royal"
    | "winged"
    | "celestial";
}) {
  if (type === "none") {
    return null;
  }

  const scale =
    type === "small"
      ? 0.65
      : type === "royal"
        ? 0.8
        : 1;

  return (
    <div
      className="absolute -top-8 left-1/2 z-30 -translate-x-1/2"
      style={{
        transform: `translateX(-50%) scale(${scale})`,
      }}
    >
      <svg
        width="100"
        height="60"
        viewBox="0 0 100 60"
        fill="none"
      >
        <path
          d="M10 15L25 38L50 8L75 38L90 15L82 50H18L10 15Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <circle
          cx="25"
          cy="38"
          r="4"
          fill="white"
          fillOpacity="0.8"
        />

        <circle
          cx="50"
          cy="8"
          r="5"
          fill="white"
          fillOpacity="0.9"
        />

        <circle
          cx="75"
          cy="38"
          r="4"
          fill="white"
          fillOpacity="0.8"
        />

        {type === "winged" ||
        type === "celestial" ? (
          <>
            <path
              d="M18 28C5 17 2 8 5 2C17 7 26 15 30 25"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />

            <path
              d="M82 28C95 17 98 8 95 2C83 7 74 15 70 25"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function Frame({
  frame,
  primary,
  secondary,
  glow,
}: {
  frame: string;
  primary: string;
  secondary: string;
  glow: string;
}) {
  return (
    <>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `3px solid ${primary}`,
          boxShadow: `
            0 0 12px ${glow},
            0 0 30px ${glow},
            inset 0 0 20px ${glow}
          `,
        }}
      />

      <div
        className="absolute inset-[-7px] rounded-full opacity-80"
        style={{
          border:
            frame === "basic"
              ? `1px solid ${secondary}`
              : `2px solid ${secondary}`,

          boxShadow:
            frame === "mythic"
              ? `
                0 0 12px ${secondary},
                0 0 35px ${glow},
                0 0 70px ${glow}
              `
              : `0 0 18px ${glow}`,
        }}
      />

      {frame !== "basic" && (
        <div
          className="absolute inset-[-13px] rounded-full border border-dashed opacity-40"
          style={{
            borderColor: primary,
          }}
        />
      )}

      {frame === "mythic" && (
        <>
          <div
            className="absolute inset-[-20px] rounded-full opacity-30 blur-sm"
            style={{
              border: `5px solid ${secondary}`,
            }}
          />

          <div
            className="absolute inset-[-27px] rounded-full"
            style={{
              borderTop: `3px solid ${primary}`,
              borderBottom: `3px solid ${secondary}`,
              opacity: 0.5,
            }}
          />
        </>
      )}
    </>
  );
}

export function LevelHero({
  progress,
}: LevelHeroProps) {
  const theme = getLevelTheme(
    progress.currentLevel,
  );

  const isMaxLevel =
    progress.nextLevel === null;

  const xpRange = isMaxLevel
    ? 1
    : Math.max(
        1,
        (progress.nextLevelXp ?? 0) -
          progress.currentLevelXp,
      );

  const barProgress = isMaxLevel
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          ((progress.totalXp -
            progress.currentLevelXp) /
            xpRange) *
            100,
        ),
      );

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-white/10 p-6"
      style={{
        background: theme.background,
        boxShadow: `
          0 20px 80px rgba(0,0,0,0.45),
          0 0 60px ${theme.glow}
        `,
      }}
    >
      {/* Background aura */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-140px] h-[320px] w-[320px] -translate-x-1/2 rounded-full blur-[100px]"
        style={{
          background:
            theme.glow,
          opacity:
            0.28 *
            theme.intensity,
        }}
      />

      {/* Tiny particles */}
      <div
        className="pointer-events-none absolute right-8 top-10 h-1 w-1 rounded-full"
        style={{
          background:
            theme.accent,
          boxShadow: `
            0 0 10px ${theme.accent},
            40px 25px 0 ${theme.primary},
            -35px 55px 0 ${theme.secondary}
          `,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{
                color: theme.secondary,
              }}
            >
              Prestige
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              {theme.tierName}
            </h2>
          </div>

          <div
            className="rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              color: theme.accent,
              borderColor:
                `${theme.primary}40`,
              background:
                `${theme.primary}12`,
            }}
          >
            {theme.frameName}
          </div>
        </div>

        {/* Crown + level */}
        <div className="relative mx-auto mt-12 h-52 w-52">
          <div
            className="absolute inset-[-45px] rounded-full blur-3xl"
            style={{
              background:
                theme.glow,
              opacity:
                0.25 *
                theme.intensity,
            }}
          />

          <Crown
            type={theme.crown}
          />

          <Frame
            frame={theme.frame}
            primary={theme.primary}
            secondary={theme.secondary}
            glow={theme.glow}
          />

          {/* Avatar placeholder */}
          <div className="absolute inset-3 overflow-hidden rounded-full bg-[#15111D]">
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(
                    circle at 50% 35%,
                    ${theme.secondary}25,
                    transparent 45%
                  ),
                  linear-gradient(
                    145deg,
                    ${theme.primary}30,
                    #15111D 70%
                  )
                `,
              }}
            />

            <div className="relative flex h-full flex-col items-center justify-center">
              <div
                className="text-6xl font-black"
                style={{
                  color:
                    theme.primary,
                  textShadow: `
                    0 0 20px ${theme.glow}
                  `,
                }}
              >
                {progress.currentLevel}
              </div>

              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/35">
                Level
              </span>
            </div>
          </div>

          {/* Level badge */}
          <div
            className="absolute -bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border px-5 py-2 shadow-xl"
            style={{
              borderColor:
                `${theme.secondary}80`,
              background:
                `linear-gradient(
                  135deg,
                  ${theme.primary},
                  ${theme.secondary}
                )`,
              color: "#100C16",
              boxShadow: `
                0 0 20px ${theme.glow}
              `,
            }}
          >
            <span className="text-xs font-black uppercase tracking-wider">
              LV.{progress.currentLevel}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="mt-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/35">
            {progress.currentTitle ??
              theme.tierName}
          </p>

          <h3 className="mt-2 text-2xl font-black text-white">
            {isMaxLevel
              ? "MYTHIC SOVEREIGN"
              : `Level ${progress.currentLevel}`}
          </h3>
        </div>

        {/* XP */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/40">
              Experience
            </span>

            <span
              className="text-xs font-bold"
              style={{
                color:
                  theme.secondary,
              }}
            >
              {isMaxLevel
                ? "MAX"
                : `${Math.round(barProgress)}%`}
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(
                  2,
                  barProgress,
                )}%`,
                background: `
                  linear-gradient(
                    90deg,
                    ${theme.primary},
                    ${theme.secondary},
                    ${theme.accent}
                  )
                `,
                boxShadow: `
                  0 0 15px ${theme.glow}
                `,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-white/25">
            <span>
              {progress.totalXp.toLocaleString()} XP
            </span>

            <span>
              {isMaxLevel
                ? "MAX LEVEL"
                : `${progress.nextLevelXp?.toLocaleString()} XP`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}