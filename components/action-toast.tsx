"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type ToastTone = "success" | "error" | "info";

export function ActionToast({
  tone,
  message,
}: {
  tone: ToastTone;
  message: string;
}) {
  const icon =
    tone === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : tone === "error" ? (
      <AlertCircle className="h-4 w-4" />
    ) : (
      <Info className="h-4 w-4" />
    );

  const classes =
    tone === "success"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
      : tone === "error"
        ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
        : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";

  return (
    <p className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${classes}`} role="status" aria-live="polite">
      {icon}
      <span>{message}</span>
    </p>
  );
}