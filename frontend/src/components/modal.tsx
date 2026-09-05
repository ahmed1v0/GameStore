"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = Readonly<{
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  tone?: "default" | "danger";
}>;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  closeDisabled = false,
  tone = "default",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function getFocusable() {
      return Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!closeDisabled) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const autofocus = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (autofocus ?? getFocusable()[0] ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, closeDisabled]);

  if (!open) return null;

  const danger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-md sm:items-center sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full max-w-xl overflow-hidden rounded-3xl border bg-[var(--surface-raised)] shadow-2xl shadow-black/50 outline-none ${
          danger ? "border-[var(--danger)]/40" : "border-[var(--border-strong)]"
        }`}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-px ${
            danger
              ? "bg-gradient-to-r from-transparent via-[var(--danger)] to-transparent"
              : "bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
          }`}
        />

        <header className="flex items-start justify-between gap-5 border-b border-[var(--border)] px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p
              className={`text-xs font-bold uppercase tracking-[0.18em] ${
                danger ? "text-[var(--danger)]" : "text-[var(--accent)]"
              }`}
            >
              {danger ? "Destructive action" : "Catalog management"}
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-bold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close modal"
            disabled={closeDisabled}
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white/[0.025] text-xl text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
