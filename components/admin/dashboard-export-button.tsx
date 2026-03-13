"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";

import { exportData } from "@/app/admin/dashboard/actions";
import { AdminButton } from "@/components/admin/admin-button";

type ExportType = "overview" | "users" | "teams" | "events" | "registrations";

export function DashboardExportButton({ type = "overview" }: { type?: ExportType }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function download(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function onExport() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await exportData(type);
        download(result.fileName, result.content, result.mimeType);
      } catch {
        setError("Falha ao exportar dados.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <AdminButton type="button" variant="ghost" className="w-full justify-start" onClick={onExport} disabled={isPending}>
        <Download className="h-4 w-4" />
        {isPending ? "Exportando..." : "Exportar Dados"}
      </AdminButton>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
