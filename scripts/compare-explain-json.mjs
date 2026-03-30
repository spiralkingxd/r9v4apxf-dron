#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${filePath}`);
  }
  return parsed;
}

function extractNode(planNode, acc) {
  if (!planNode || typeof planNode !== "object") return;
  const nodeType = String(planNode["Node Type"] ?? "");
  if (nodeType.includes("Seq Scan")) acc.seqScans += 1;
  if (nodeType.includes("Index Scan") || nodeType.includes("Bitmap Index Scan")) acc.indexScans += 1;
  if (Array.isArray(planNode.Plans)) {
    for (const child of planNode.Plans) extractNode(child, acc);
  }
}

function parseExplainEntry(entry) {
  const root = entry?.["QUERY PLAN"]?.[0];
  if (!root || typeof root !== "object") {
    throw new Error("Invalid explain entry: missing QUERY PLAN[0]");
  }

  const counters = { seqScans: 0, indexScans: 0 };
  extractNode(root.Plan, counters);

  return {
    executionMs: Number(root["Execution Time"] ?? 0),
    planningMs: Number(root["Planning Time"] ?? 0),
    sharedHit: Number(root?.["Shared Hit Blocks"] ?? 0),
    sharedRead: Number(root?.["Shared Read Blocks"] ?? 0),
    seqScans: counters.seqScans,
    indexScans: counters.indexScans,
  };
}

function pctDelta(before, after) {
  if (!Number.isFinite(before) || before === 0) return "n/a";
  return `${(((after - before) / before) * 100).toFixed(1)}%`;
}

function formatNum(value, decimals = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function main() {
  const beforePath = process.argv[2];
  const afterPath = process.argv[3];
  const outFlagIndex = process.argv.indexOf("--out");
  const outPath = outFlagIndex >= 0 ? process.argv[outFlagIndex + 1] : null;
  if (!beforePath || !afterPath) {
    console.error("Usage: node scripts/compare-explain-json.mjs <before.json> <after.json> [--out report.md]");
    process.exit(1);
  }

  const before = readJson(path.resolve(beforePath));
  const after = readJson(path.resolve(afterPath));

  if (before.length !== after.length) {
    throw new Error(`Mismatched query count: before=${before.length} after=${after.length}`);
  }

  const rows = [];
  for (let i = 0; i < before.length; i += 1) {
    const b = parseExplainEntry(before[i]);
    const a = parseExplainEntry(after[i]);
    rows.push({
      query: `Q${i + 1}`,
      bExec: b.executionMs,
      aExec: a.executionMs,
      dExec: pctDelta(b.executionMs, a.executionMs),
      bPlan: b.planningMs,
      aPlan: a.planningMs,
      dPlan: pctDelta(b.planningMs, a.planningMs),
      bSeq: b.seqScans,
      aSeq: a.seqScans,
      bIdx: b.indexScans,
      aIdx: a.indexScans,
    });
  }

  const lines = [];
  lines.push("| Query | Exec Before (ms) | Exec After (ms) | Delta Exec | Plan Before (ms) | Plan After (ms) | Delta Plan | Seq Before | Seq After | Index Before | Index After |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    lines.push(`| ${row.query} | ${formatNum(row.bExec)} | ${formatNum(row.aExec)} | ${row.dExec} | ${formatNum(row.bPlan)} | ${formatNum(row.aPlan)} | ${row.dPlan} | ${row.bSeq} | ${row.aSeq} | ${row.bIdx} | ${row.aIdx} |`);
  }

  // Prefer human label from template when available.
  for (let i = 0; i < before.length; i += 1) {
    const label = before[i]?._query;
    if (typeof label === "string" && label.trim()) {
      lines[i + 2] = lines[i + 2].replace(`| Q${i + 1} |`, `| ${label.trim()} |`);
    }
  }

  const output = lines.join("\n");
  console.log(output);

  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), `${output}\n`, "utf8");
  }
}

main();
