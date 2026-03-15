import { AlertCircle, Gamepad2 } from "lucide-react";

interface XboxStatusTagProps {
  gamertag: string | null | undefined;
}

export function XboxStatusTag({ gamertag }: XboxStatusTagProps) {
  if (gamertag) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 dark:border-cyan-400/40 bg-cyan-100 dark:bg-cyan-400/15 px-3 py-1 text-sm font-medium text-cyan-700 dark:text-cyan-300">
        <Gamepad2 className="h-4 w-4 shrink-0" />
        {gamertag}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600/60 bg-slate-100 dark:bg-slate-700/40 px-3 py-1 text-sm text-slate-500 dark:text-slate-400">
      <AlertCircle className="h-4 w-4 shrink-0" />
      Sem conta Xbox vinculada
    </span>
  );
}
