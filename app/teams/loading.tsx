import { Loader2 } from "lucide-react";
import { getDictionary } from "@/lib/i18n";

export default async function Loading() {
	const dict = await getDictionary();

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-8">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="h-8 w-8 animate-spin text-amber-500" />
				<p className="text-sm font-medium text-slate-400 animate-pulse">{dict.teams.loadingTeams}</p>
			</div>
		</div>
	);
}