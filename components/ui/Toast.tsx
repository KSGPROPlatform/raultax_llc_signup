"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

// Lightweight, dependency-free toast system. Mounted once (in DashboardShell);
// anywhere below can call useToast() and fire success/error/info messages.
// Accessible: the live region announces politely without stealing focus, each
// toast pairs an icon with text (never colour alone), and auto-dismisses.

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND = {
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-200 dark:border-emerald-500/30",
    bg: "bg-white dark:bg-zinc-900",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: AlertTriangle,
    ring: "border-red-200 dark:border-red-500/30",
    bg: "bg-white dark:bg-zinc-900",
    accent: "text-red-600 dark:text-red-400",
  },
  info: {
    icon: Info,
    ring: "border-zinc-200 dark:border-zinc-700",
    bg: "bg-white dark:bg-zinc-900",
    accent: "text-amber-600 dark:text-amber-400",
  },
} as const;

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      const timer = setTimeout(() => dismiss(id), DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useRef<ToastApi>({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  });
  // Keep the closure current without changing identity (stable across renders).
  api.current.success = (m) => push("success", m);
  api.current.error = (m) => push("error", m);
  api.current.info = (m) => push("info", m);

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      >
        {toasts.map((t) => {
          const k = KIND[t.kind];
          const Icon = k.icon;
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${k.ring} ${k.bg} px-4 py-3 shadow-lg motion-safe:animate-[toastIn_200ms_ease-out]`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${k.accent}`} />
              <p className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-100">
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastContext.Provider>
  );
}

// Returns a stable toast API. Safe to call even if no provider is mounted
// (falls back to no-ops so components never crash outside the dashboard).
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  const noop = useRef<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });
  return ctx ?? noop.current;
}
