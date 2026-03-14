import { NextResponse } from "next/server";

import { assertAdminAccess } from "@/app/admin/_lib";
import { getEventRegistrations } from "@/app/admin/tournaments/_data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminAccess();
    const { id } = await context.params;
    const { event, registrations } = await getEventRegistrations(id, "tournament");

    const header = ["team_id", "team_name", "captain_name", "status", "source", "created_at", "rejection_reason"];
    const lines = [header.join(",")];

    for (const row of registrations) {
      lines.push([
        row.team_id,
        row.team_name,
        row.captain_name,
        row.status,
        row.source,
        row.created_at,
        row.rejection_reason ?? "",
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${event.id}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}
