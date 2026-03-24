import assert from "node:assert/strict";
import fs from "node:fs";

function calcTotalRounds(round1Count) {
  if (round1Count <= 0) return 1;
  return Math.max(1, Math.round(Math.log2(round1Count * 2)));
}

function expectedSlotsForRound(round, round1Count) {
  return Math.max(1, Math.ceil(round1Count / Math.pow(2, round - 1)));
}

function slotIndexFromPosition(position) {
  if (!position) return Number.POSITIVE_INFINITY;
  const m = /R\d+-M(\d+)/i.exec(position.trim());
  return m ? Number(m[1]) - 1 : Number.POSITIVE_INFINITY;
}

function buildRoundSlots(matches, totalRounds, round1Count) {
  const byRound = new Map();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round).push(m);
  }

  const out = new Map();
  for (let r = 1; r <= totalRounds; r++) {
    const real = (byRound.get(r) || []).sort(
      (a, b) => slotIndexFromPosition(a.bracket_position) - slotIndexFromPosition(b.bracket_position),
    );

    const expected = expectedSlotsForRound(r, Math.max(round1Count, 1));
    const slotMap = new Map();
    let nextAuto = 0;

    for (const m of real) {
      const idx = slotIndexFromPosition(m.bracket_position);
      const assigned = Number.isFinite(idx) ? idx : nextAuto++;
      slotMap.set(assigned, m);
      if (Number.isFinite(idx)) nextAuto = Math.max(nextAuto, assigned + 1);
    }

    const slots = [];
    for (let s = 0; s < expected; s++) {
      if (slotMap.has(s)) {
        slots.push(slotMap.get(s));
        slotMap.delete(s);
      } else {
        slots.push({ id: `virtual-R${r}-S${s}`, isVirtual: true, round: r, slotIndex: s });
      }
    }

    for (const m of slotMap.values()) slots.push(m);
    out.set(r, slots);
  }

  return out;
}

function getVp(w) {
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function createRoundOneMatches(teamCount) {
  const matchCount = teamCount / 2;
  return Array.from({ length: matchCount }, (_, i) => ({
    id: `r1m${i + 1}`,
    round: 1,
    bracket_position: `R1-M${i + 1}`,
  }));
}

function testRoundMath() {
  const cases = [
    { teams: 4, rounds: 2 },
    { teams: 8, rounds: 3 },
    { teams: 16, rounds: 4 },
    { teams: 32, rounds: 5 },
  ];

  for (const c of cases) {
    const round1Count = c.teams / 2;
    assert.equal(calcTotalRounds(round1Count), c.rounds, `${c.teams} equipes deve gerar ${c.rounds} rounds`);
  }
}

function testRoundSlotAdaptation() {
  const cases = [4, 8, 16, 32];

  for (const teams of cases) {
    const round1Count = teams / 2;
    const totalRounds = calcTotalRounds(round1Count);
    const matches = createRoundOneMatches(teams);
    const roundSlots = buildRoundSlots(matches, totalRounds, round1Count);

    assert.equal(roundSlots.size, totalRounds, `deve haver ${totalRounds} rounds para ${teams} equipes`);

    for (let r = 1; r <= totalRounds; r++) {
      const expected = expectedSlotsForRound(r, round1Count);
      const slots = roundSlots.get(r) || [];
      assert.equal(slots.length, expected, `round ${r} deve ter ${expected} slots para ${teams} equipes`);
    }
  }
}

function testProgressionFill() {
  const round1 = [
    { id: "r1m1", round: 1, bracket_position: "R1-M1" },
    { id: "r1m2", round: 1, bracket_position: "R1-M2" },
  ];

  const totalRounds = calcTotalRounds(2);

  const before = buildRoundSlots(round1, totalRounds, 2);
  const beforeR2 = before.get(2) || [];
  assert.equal(beforeR2.filter((s) => s.isVirtual === true).length, 1, "antes da progressão final deve estar como slot vazio");

  const after = buildRoundSlots(
    [
      ...round1,
      { id: "r2m1", round: 2, bracket_position: "R2-M1", team_a_id: "winner-r1m1", team_b_id: null },
    ],
    totalRounds,
    2,
  );

  const afterR2 = after.get(2) || [];
  assert.equal(afterR2.filter((s) => s.isVirtual === true).length, 0, "após progressão o slot deve ser preenchido por partida real");
}

function testEmptySlotLabelExists() {
  const source = fs.readFileSync("components/bracket/bracket-visual-layout.tsx", "utf8");
  assert.match(source, /A definir/, "placeholder 'A definir' deve existir no componente");
}

function testResponsiveBreakpoints() {
  const checks = [
    { width: 1920, expected: "desktop" },
    { width: 1366, expected: "desktop" },
    { width: 1024, expected: "desktop" },
    { width: 834, expected: "tablet" },
    { width: 768, expected: "tablet" },
    { width: 414, expected: "mobile" },
    { width: 375, expected: "mobile" },
  ];

  for (const c of checks) {
    assert.equal(getVp(c.width), c.expected, `${c.width}px deve cair em ${c.expected}`);
  }
}

function run() {
  const tests = [
    ["Round math (4/8/16/32)", testRoundMath],
    ["Round slot adaptation", testRoundSlotAdaptation],
    ["Progression fill", testProgressionFill],
    ["Empty slot label", testEmptySlotLabelExists],
    ["Responsive breakpoints", testResponsiveBreakpoints],
  ];

  let pass = 0;
  for (const [name, fn] of tests) {
    fn();
    pass += 1;
    console.log(`PASS: ${name}`);
  }

  console.log(`\nSummary: ${pass}/${tests.length} checks passed.`);
}

run();
