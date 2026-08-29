// File: components/tasks/tasks-motion-styles.tsx

export function TasksMotionStyles() {
  return (
    <style>{`
      @keyframes tk-glow-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      .tk-glow { animation: tk-glow-pulse 2.4s ease-in-out infinite; }

      @keyframes tk-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,185,63,0); }
        50% { box-shadow: 0 0 0 6px rgba(245,185,63,0.18); }
      }
      .tk-pulse { animation: tk-pulse-ring 2s ease-in-out infinite; }

      @keyframes tk-celebrate-in {
        from { opacity: 0; transform: translateY(16px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .tk-celebrate { animation: tk-celebrate-in 0.35s ease-out; }

      @keyframes tk-check-pop {
        0% { transform: scale(0.6); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      .tk-check-pop { animation: tk-check-pop 0.3s ease-out; }
    `}</style>
  );
}