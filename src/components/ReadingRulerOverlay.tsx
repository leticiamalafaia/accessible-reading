import React, { useEffect, useRef } from "react";

interface ReadingRulerOverlayProps {
  enabled: boolean;
  isDark: boolean;
  bandHeight: number;
  isPlaying: boolean;
  getActiveSentenceRect: () => DOMRect | null;
  speechSyncKey: string;
}

export const ReadingRulerOverlay: React.FC<ReadingRulerOverlayProps> = ({
  enabled,
  isDark,
  bandHeight,
  isPlaying,
  getActiveSentenceRect,
  speechSyncKey,
}) => {
  const topMaskRef = useRef<HTMLDivElement | null>(null);
  const rulerYRef = useRef<number>(280);
  const rafRef = useRef<number | null>(null);

  const applyRulerY = (y: number) => {
    const clamped = Math.max(80, Math.min(window.innerHeight - 60, y));
    rulerYRef.current = clamped;
    if (topMaskRef.current) {
      topMaskRef.current.style.height = `${Math.max(0, clamped - bandHeight / 2)}px`;
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isPlaying) return;
      const clientY = e.clientY;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        applyRulerY(clientY);
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        applyRulerY(rulerYRef.current + 36);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        applyRulerY(rulerYRef.current - 36);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [bandHeight, enabled, isPlaying]);

  useEffect(() => {
    if (!enabled || !isPlaying) return;
    const rect = getActiveSentenceRect();
    if (rect) {
      applyRulerY(rect.top + rect.height / 2);
    }
  }, [bandHeight, enabled, getActiveSentenceRect, isPlaying, speechSyncKey]);

  if (!enabled) return null;

  const maskColor = isDark ? "rgba(0,0,0,0.58)" : "rgba(15,23,42,0.22)";
  const lineColor = isDark ? "#38BDF8" : "#0F766E";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10">
      <div
        ref={topMaskRef}
        style={{
          height: `${Math.max(0, rulerYRef.current - bandHeight / 2)}px`,
          backgroundColor: maskColor,
        }}
        className="w-full"
      />
      <div
        style={{
          height: `${bandHeight}px`,
          borderTop: `2px solid ${lineColor}`,
          borderBottom: `2px solid ${lineColor}`,
        }}
        className="w-full bg-transparent"
      />
      <div
        style={{
          backgroundColor: maskColor,
        }}
        className="h-full w-full"
      />
    </div>
  );
};
