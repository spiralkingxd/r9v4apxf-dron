import { NextResponse } from "next/server";

import { assertAdminAccess } from "@/app/admin/_lib";
import { getTournamentBracketData } from "@/app/admin/matches/_data";

const WIDTH = 1320;
const COL_WIDTH = 300;
const CARD_HEIGHT = 90;
const GAP_Y = 26;
const START_X = 24;
const START_Y = 24;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminAccess();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "pdf" ? "pdf" : "svg";
    const { id } = await context.params;
    const { event, matches } = await getTournamentBracketData(id);

    const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
    const byRound = new Map<number, typeof matches>();
    for (const round of rounds) {
      byRound.set(round, matches.filter((match) => match.round === round));
    }

    const totalHeight = Math.max(
      480,
      ...rounds.map((round) => START_Y * 2 + (byRound.get(round)?.length ?? 0) * (CARD_HEIGHT + GAP_Y)),
    );

    const roundBlocks = rounds
      .map((round, roundIndex) => {
        const list = byRound.get(round) ?? [];
        const x = START_X + roundIndex * (COL_WIDTH + 20);
        const cards = list
          .map((match, index) => {
            const y = START_Y + 40 + index * (CARD_HEIGHT + GAP_Y);
            const statusColor =
              match.status === "finished"
                ? "#14532d"
                : match.status === "in_progress"
                  ? "#164e63"
                  : match.status === "cancelled"
                    ? "#7f1d1d"
                    : "#334155";
            const winnerA = match.winner_id && match.team_a_id && match.winner_id === match.team_a_id;
            const winnerB = match.winner_id && match.team_b_id && match.winner_id === match.team_b_id;

            return `
              <g>
                <rect x="${x}" y="${y}" width="${COL_WIDTH}" height="${CARD_HEIGHT}" rx="12" fill="#0b1220" stroke="#1e293b" />
                <rect x="${x + COL_WIDTH - 86}" y="${y + 8}" width="78" height="18" rx="9" fill="${statusColor}" />
                <text x="${x + COL_WIDTH - 47}" y="${y + 21}" text-anchor="middle" font-size="10" fill="#e2e8f0">${match.status}</text>

                <text x="${x + 12}" y="${y + 28}" font-size="12" fill="${winnerA ? "#86efac" : "#e2e8f0"}">${match.team_a_name} (${match.score_a})</text>
                <text x="${x + 12}" y="${y + 54}" font-size="12" fill="${winnerB ? "#86efac" : "#e2e8f0"}">${match.team_b_name} (${match.score_b})</text>
                <text x="${x + 12}" y="${y + 75}" font-size="10" fill="#94a3b8">${match.bracket_position ?? "-"}</text>
              </g>
            `;
          })
          .join("\n");

        return `
          <g>
            <text x="${x}" y="${START_Y + 18}" font-size="14" font-weight="700" fill="#67e8f9">Rodada ${round}</text>
            ${cards}
          </g>
        `;
      })
      .join("\n");

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(WIDTH, START_X * 2 + rounds.length * (COL_WIDTH + 20))}" height="${totalHeight}" viewBox="0 0 ${Math.max(WIDTH, START_X * 2 + rounds.length * (COL_WIDTH + 20))} ${totalHeight}">
        <rect width="100%" height="100%" fill="#020617" />
        <text x="24" y="20" font-size="16" font-weight="700" fill="#f8fafc">Bracket: ${event.title}</text>
        ${roundBlocks}
      </svg>
    `.trim();

    if (format === "pdf") {
      const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Bracket ${event.title}</title>
    <style>
      body { margin: 0; padding: 16px; background: #020617; color: #e2e8f0; font-family: system-ui, sans-serif; }
      .hint { margin-bottom: 8px; font-size: 12px; opacity: 0.7; }
      .wrap { background: #020617; }
      @media print { .hint { display: none; } body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="hint">Use Ctrl+P para salvar como PDF.</div>
    <div class="wrap">${svg}</div>
  </body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="bracket-${event.id}.svg"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}
