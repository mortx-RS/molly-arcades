import { useEffect, useRef } from "react";
import { T } from "./theme";

interface Props {
  open: boolean;
  onClose(): void;
  children: React.ReactNode;
  /** Optional title shown above the handle */
  title?: string;
}

export function BottomDrawer({ open, onClose, children, title }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: T.overlayBg,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 200,
        padding: "0 0 env(safe-area-inset-bottom, 0px)",
        animation: "fadeIn 0.2s ease"
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85dvh",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "slideUpDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          ...T.glass(T.charcoal)
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineStrong }} />
        </div>

        {/* Title */}
        {title && (
          <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, margin: 0, textAlign: "center", letterSpacing: "0.01em" }}>
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
