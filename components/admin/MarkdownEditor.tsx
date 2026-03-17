"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ICommand } from "@uiw/react-md-editor/commands";
import * as commands from "@uiw/react-md-editor/commands";

import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

const MDEditor = dynamic(() => import("@uiw/react-md-editor/nohighlight"), {
  ssr: false,
});

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  helperText?: string;
  previewLabel?: string;
};

const toolbarCommands: ICommand[] = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.divider,
  commands.title1,
  commands.title2,
  commands.title3,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.checkedListCommand,
  commands.divider,
  commands.link,
  commands.quote,
  commands.codeBlock,
  commands.table,
  commands.hr,
];

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder = "Escreva em Markdown...",
  minHeight = 560,
  helperText = "Use Markdown para estruturar titulos, listas, links, tabelas e blocos de codigo.",
  previewLabel = "Preview em tempo real",
}: Props) {
  const [colorMode, setColorMode] = useState("dark");
  const [editorHeight, setEditorHeight] = useState(minHeight);

  useEffect(() => {
    const root = document.documentElement;
    const syncColorMode = () => {
      setColorMode(root.getAttribute("data-theme") === "light" ? "light" : "dark");
    };

    syncColorMode();

    const observer = new MutationObserver(syncColorMode);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncEditorHeight = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const baseByViewport = viewportWidth < 640 ? 400 : viewportWidth < 1024 ? 520 : 640;
      const maxFit = Math.max(380, viewportHeight - (viewportWidth < 640 ? 260 : 300));

      setEditorHeight(Math.max(baseByViewport, Math.min(maxFit, Math.max(minHeight, 760))));
    };

    syncEditorHeight();
    window.addEventListener("resize", syncEditorHeight);

    return () => window.removeEventListener("resize", syncEditorHeight);
  }, [minHeight]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-[color:var(--text-strong)]">{label}</div>
        <p className="text-xs text-[color:var(--text-muted)]">{helperText}</p>
      </div>

      <div className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
        <div className="w-full overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--topbar-bg)]">
          <div className="border-b border-[color:var(--surface-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            Markdown
          </div>
          <div className="markdown-editor-shell w-full" data-color-mode={colorMode}>
            <MDEditor
              value={value}
              onChange={(nextValue) => onChange(nextValue ?? "")}
              preview="edit"
              commands={toolbarCommands}
              extraCommands={[]}
              visibleDragbar={false}
              height={editorHeight}
              textareaProps={{
                placeholder,
                "aria-label": label,
              }}
            />
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--topbar-bg)]">
          <div className="border-b border-[color:var(--surface-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            {previewLabel}
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-4">
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--surface-border)] bg-black/10 px-4 py-6 text-sm text-[color:var(--text-muted)]">
                O preview aparece aqui automaticamente enquanto voce escreve.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
