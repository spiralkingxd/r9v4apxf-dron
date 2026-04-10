"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TARGET_SELECTOR = [
  "main section",
  "main article",
  "main .glass-card",
  "main .soft-ring",
  "main .quick-card",
  "main .sot-board",
].join(", ");

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
    if (nodes.length === 0) return;

    nodes.forEach((node, index) => {
      node.classList.add("scroll-reveal");
      node.style.setProperty("--reveal-delay", `${Math.min(index * 40, 320)}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("scroll-reveal--visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

