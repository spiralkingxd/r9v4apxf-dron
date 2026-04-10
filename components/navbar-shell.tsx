"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type NavbarShellProps = {
  children: ReactNode;
};

export function NavbarShell({ children }: NavbarShellProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "site-topbar sticky top-0 z-50 transition-all duration-500",
        scrolled ? "site-topbar-scrolled" : "site-topbar-at-top",
      )}
    >
      {children}
    </header>
  );
}
