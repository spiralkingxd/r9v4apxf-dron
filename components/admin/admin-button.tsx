"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "danger" | "success" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const AdminButton = forwardRef<HTMLButtonElement, Props>(function AdminButton(
  { className, variant = "primary", ...props },
  ref,
) {
  const variants: Record<Variant, string> = {
    primary: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
    danger: "bg-rose-500 text-white hover:bg-rose-400 dark:text-white text-[color:var(--foreground)]",
    success: "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
    ghost: "border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] text-[color:var(--text-strong)] hover:bg-black/5 dark:hover:bg-white/10",
  };

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
