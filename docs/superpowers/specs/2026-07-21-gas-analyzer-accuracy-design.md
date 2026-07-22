# Gas Analyzer Accuracy — Observation & Improvement Spec

**Date:** 2026-07-21
**Status:** Proposed
**Scope:** `signum-smartc` skill — `lib/gas/analyzer.js`, `scripts/gas-analysis.js`, and the skill's activation-sizing guidance. Motivated by `character/character.contract.smart.c`.
**Related:** `2026-07-11-character-reroll-economy-design.md`, `2026-07-12-registry-as-config-design.md` (combat-profile republish cache)

---

## Summary

The static gas analyzer's per-activation figures for `character.contract.smart.c`
overstate the real cost by roughly **2×** (typical column) to **5×** (Max column).
Empirical measurement against the testbed simulator — whose fee model is
byte-for-byte identical to mainnet — puts the worst realistic single-tx
activation at **~2.74 SIGNA**, versus the analyzer's reported **4.08 typical /
13.66 upper-bound**.

The analyzer operates on **compiled CIYAM AT assembly** (`SmartC.getAssemblyCode()`),
not the C source. That constraint kills any idea based on C-level source
annotations (comments do not survive compilation) — but it turns out the assembly
is a *good* level at which to fix the dominant error, because the guards that make
branches mutually exclusive are lowered to explicit `Bxx $cell` tests on named
memory cells, and constants are emitted explicitly. This document records the
measurement (the *observation*) and specifies assembly-level analysis changes that
tighten accuracy while preserving soundness (the analyzer must never
under-estimate).

---

## Part 1 — Observation

### Method

The `signum-smartc-testbed` simulator uses the exact mainnet AT fee model, verified
in `smartc-signum-simulator/dist/cpu.js` and `index.js`:

| Parameter | Value | Matches node |
|---|---|---|
| `stepfee` | `100000` planck = 0.001 SIGNA/step | ✅ |
| ordinary opcode | 1 step | ✅ |
| API call (`FUN`) | 10 steps | ✅ |
| `maxStepsEachBlock` | 1_000_000 (100 SIGNA/block cap) | ✅ |
| gas source | burned from **total contract balance**, not per-tx | ✅ |

`postForgeBlock()` burns `executionFee` (the block's real gas) from the contract
balance once per activation, then resets it. Measuring is therefore exact: spy on
`Blockchain.burnBalance(accountId, amount)`, filter by the character address, and
sum across a single triggering transaction. That sum **is** the whole-activation
cost (per-tx preamble + handler + post-loop) along the branch the real data took.

### Measured results (SIGNA per single-tx activation)

| Path | Empirical | Notes |
|---|---:|---|
| transferItem, **4-effect** weapon | **2.74** | true worst realistic single tx |
| deposit **4-effect** weapon (auto-equip) | 2.71 | |
| reroll | 2.24 | always carries ≥100 SIGNA — cannot under-fund |
| receiveAttack + status effect | 2.13 | construct-funded |
| transferItem, 1-effect equipment | 2.10 | |
| deposit 1-effect equipment | 2.07 | |
| allocateSkillPoint | 1.74 | |
| useItem (consumable) | 0.85 | |
| receiveAttack (pure damage) | 0.71 | |
| attack (forward to construct) | 0.69 | |
| migrate (liquidate 2 items + XP + SIGNA) | 0.60 | |
| deposit XP → 5× levelUp loop | 0.56 | loop is API-free |
| poke (no-op, combat clean) | 0.44 | per-activation floor |

Analyzer for comparison (transferItem): `1.729` (handler, 1×) + `2.349`
(post-loop, 1×) = **4.08 typical**; Max upper bound ≈ **13.66**.

### The analyzer's actual input: assembly, not C

`analyzeContract()` calls `SmartC.compile()` then `analyzeAssembly(getAssemblyCode())`;
all reasoning is over the assembly text. Consequences that shape any fix:

- **C comments and identifiers of intent are gone.** There is no way to read a
  `// @gas-...` hint from the source. Anything the analyzer "knows" it must recover
  from the instruction stream.
- **But the compiler lowers guards uniformly.** A C `if (isDead) {…}` becomes
  `BNE $isDead $TRUE :label`; `if (!isDead) {…}` becomes `BNE $isDead $FALSE :label`.
  Both test the **same, stably-named memory cell** (`$isDead`). Mutual exclusivity
  is therefore *visible* in the assembly as two branches on one cell with opposite
  senses.
- **Constants are explicit.** The compiler emits `^const SET @ZERO #…0`,
  `@TRUE #…1`, `@FALSE #…0`, `@FIVE #…5`, etc. (These `^const` lines are currently
  *discarded* by the parser — `t.startsWith('^') → continue` — so the analyzer
  throws away the exact 0/1 constant table it needs.) Even with
  `#pragma verboseAssembly false`, these cells are still each written once with an
  immediate and never rewritten, so they are recoverable by a one-pass scan.
- **Some loop bounds are literals in the stream.** `for (i=0;i<10;…)` compiles to a
  compare of the induction cell against an immediate/const cell — readable — while
  `for (i=0;i<usedInventorySlots;…)` compares against a runtime cell — not.

### Root causes of the overstatement (as they appear in assembly)

The analyzer computes the **longest path** through the CFG (`maxCost`/`maxCostTo`,
`best = Math.max(...)`). It has no model of cell values, so at every `Bxx` it may
take both successors. Four mechanisms, most-impactful first:

1. **Contradictory branches on the same cell are both counted.** The post-loop
   (assembly lines 655–663 of the verbose dump) is:
   ```
   BNE $migrated $FALSE :skip_all        // if (migrated == FALSE)
   BNE $isDead   $TRUE  :skip_dead       //   if (isDead == TRUE)  → handleDead()
   BNE $deathPenaltyApplied $FALSE :…
        …handleDead()…                   //   (does NOT write $isDead)
   skip_dead:
   BNE $isDead   $FALSE :skip_level      //   if (isDead == FALSE) → checkLevelUp()
        …checkLevelUp()…
   skip_level:
   BNE $main_refundRequested $TRUE :…    //   if (refundRequested)  → refund()
   ```
   Reaching `handleDead()` requires falling through line 656 → `$isDead ≠ 0` on that
   path. Line 660 then tests `$isDead == FALSE`; since `$isDead` is unwritten between
   the two and known ≠ 0, `checkLevelUp()` is *infeasible* on that path — yet the
   longest-path walk descends into it anyway. This single false combination
   (handleDead + checkLevelUp + full republish) is why the analyzer's post-loop
   figure alone (2.349) exceeds the entire measured dirty activation (2.10).

2. **Flag-gated blocks are always taken.** `publishCombatProfileIfNeeded()`
   (lines 244–260) is `BNE $publishCombatProfileIfNeeded_dirty $FALSE :endif` gating
   the ~34-map-op `publishCombatProfile()`, with `SET @combatDirty $FALSE` after. The
   walk always takes the "republish runs" edge, so **every** method is charged the
   full republish — even the ~⅔ of actions (useItem, attack, receiveAttack, plain
   deposits) that never execute a `SET @combatDirty $TRUE` and empirically pay
   0.44–0.85. A special case of (1), and the biggest per-method distortion.

3. **The "typical / 1×loop" column is still a worst-branch bound.** `oneRunSteps` is
   `maxCost` with `loopCap = 1`: it enters each loop once but still selects the
   longest branch at every `Bxx`. Describing it as "near-empirical" is wrong; it is
   "worst branch, loops taken once," which is why even the 1× sum (4.08) is ~2× the
   truth (2.10).

4. **MAX assumes loop-cap × full API cost, blind to loop contents and real bounds.**
   Every data-dependent back-edge is taken `--loop-cap` (10) times with in-loop API
   charged 10 steps each. It neither reads a literal loop bound that is present in
   the stream (`handleDead`'s 10-try drop loop, `rollAttributes`' 5) nor distinguishes
   API-heavy loops from API-free ones — it flagged `checkLevelUp` as a multi-SIGNA
   hazard, but that loop is pure arithmetic (its only API, `getAssetBalance`, sits
   outside it) and a 5-level windfall measured **0.56**.

**The analyzer is sound, not buggy:** an upper bound must never under-estimate or
`activationAmount` gets under-sized and the contract can freeze. The defect is
looseness, plus the mis-use (mine included) of reading the summed 1×/Max as the
*expected* cost rather than as a ceiling.

---

## Part 2 — Spec: assembly-level accuracy improvements

Everything below operates on the instruction stream only. Goal: emit an
**expected** per-activation cost within **±20%** of the testbed measurement for
`character.contract.smart.c`, while the **Max** column stays a sound ceiling
(≥ empirical worst, always). Tiers are independently shippable.

### Tier 0 — Recover the constant table (prerequisite, trivial)

Stop discarding `^const SET @cell #imm` lines; parse them into a
`constCell → value` table. Additionally, in one pre-pass over the whole program,
mark any cell that is assigned an immediate exactly once and never written again as
a global constant (this recovers `$ZERO/$TRUE/$FALSE/$FIVE/…` and `maxConstVars`
fold cells even when `#pragma verboseAssembly false` suppresses the `^const`
comments). Seed every per-handler/per-method analysis with this table. No behaviour
change yet — it is the input the next tiers need.

### Tier 1 — Flag/constant abstract interpretation (the core fix)

Carry a tiny abstract state through the existing DFS: a map
`cell → {⊤ | =0 | ≠0 | =k}` (k from Tier 0). Rules:

- **Seed** with the Tier-0 constants; all other cells `⊤` (unknown).
- On `SET @c #imm` → `c := =imm`; on `SET @c $const` where the RHS is a known
  constant → propagate it; on any other write to `c` → `c := ⊤`.
- At a two-way branch `Bxx $c <ref>` where the compared value is known and `$c`'s
  abstract value **decides** the test (e.g. `BNE $isDead $FALSE` with
  `$isDead == ≠0`), follow **only** the feasible successor; record the implied
  refinement of `$c` on each taken edge (fall-through vs target).
- When the test is undecided (`$c = ⊤` or comparison to a non-constant), follow both
  (unchanged, sound).

This is enough for a 3-value boolean lattice — exactly what the flag cells
(`isDead`, `migrated`, `committed`, `deathPenaltyApplied`, `combatDirty`,
`main_refundRequested`) need. Two consequences:

- **Sound Max tightening (no assumptions).** Starting every path with flags `⊤`,
  the pass removes only *infeasible* paths (e.g. handleDead ⇒ checkLevelUp pruned via
  the shared unwritten `$isDead`). Max stays a valid upper bound and drops the
  dominant false combination. Requires the "unwritten between the two tests" check —
  cheap, since writes to `$c` reset it to `⊤` and re-open both edges (conservative).
- **A real "expected" column.** Recompute with activation-entry flags seeded to their
  reset values for the *expected* figure only (see Tier 2). Under this seed the
  combat republish is counted only on paths that actually `SET @combatDirty $TRUE`,
  matching the empirical clean/dirty split.

Complexity stays bounded: the abstract state is a handful of cells; memoization keys
(`fnCache`) gain the abstract state, but flags collapse to few reachable
combinations in practice.

### Tier 2 — Entry-state seeding for the expected column (heuristic)

The `combatDirty == FALSE at activation start` property is a cross-activation
invariant a single-activation walk cannot prove. Offer it as an **explicit,
opt-in expected-column assumption**, derived automatically where cheaply provable:

- A flag cell may be seeded `=0` at activation entry for the **expected** column iff
  **every** activation-exit path writes it to a known `0` before `FIN`
  (a backward check over exit paths). Cells that fail the check stay `⊤` even in the
  expected column (sound-ish: never used for the ceiling).
- The **Max** column never uses this seeding — it always starts flags `⊤`.

For the character contract this needs a light touch: `combatDirty` is reset to
`FALSE` only on the republish path, so the strict check won't seed it. Fallback that
still matches reality: for the expected column, treat a flag-gated call as counted
**iff the current path writes the flag true**; otherwise report it as a separate
"+X when entered dirty" addend rather than baking it into the mandatory figure (see
reporting changes). This reproduces the measured split without an unsound assumption.

### Tier 3 — Literal loop-bound detection (sound, both columns)

When a loop's exit test compares the induction cell against a **constant** (Tier-0
known) — `BGE $i $n2` with `$n2 = 10` — use that constant as the loop's iteration
count instead of `--loop-cap`, for both Max and expected. Loops whose bound is a
runtime cell (`usedInventorySlots`, `effectCount`) keep `--loop-cap` and are
**labelled data-dependent** in the report. This is exact for the constant-bounded
loops (`handleDead` drop loop = 10, `rollAttributes` = 5 once its `skillPoints=5`
seed is propagated) and removes the "API-free loop flagged as hazard" noise by
reporting per-loop whether any `FUN` occurs inside the back-edge.

### Tier 4 — Empirical reconciliation (ground truth)

The testbed computes exact gas; make it first-class:

- Ship a `measure` companion (script or documented recipe) that spies on
  `burnBalance`, drives each method through one activation, and prints a **measured**
  SIGNA column. The harness in the appendix is the reference implementation.
- `scripts/gas-analysis.js` gains `--measured <json>`; when present it prints
  static-vs-measured side by side and **flags any row where `measured > Max`** — a
  soundness violation that means the abstract interpretation pruned a *feasible* path
  (a bug to fix, not a tolerance).
- Guidance: size `activationAmount` off **measured worst × 1.1–1.2** when a
  measurement exists; fall back to static Max otherwise.

### Reporting changes (apply regardless of tier)

- **Relabel the middle column** from "1×loop / typical" to `worst-branch (loops×1)`
  and stop calling it near-empirical until Tiers 1–2 produce an honest expected figure.
- **Separate mandatory from conditional**: report post-loop as
  `base (+ republish when a path sets combatDirty)` rather than one baked-in number.
- **Present activation guidance as a range**: `expected ≈ X SIGNA · hard ceiling ≤ Y
  SIGNA (static Max)`, recommending `activationAmount` from the expected worst.
- **Name cells when available.** Reports read far better with
  `#pragma verboseAssembly true` (named cells/labels). Recommend the skill compile
  with verbose on for analysis; degrade to raw operands otherwise (analysis is
  unaffected — only readability is).

### What remains hard or impossible on assembly (stated honestly)

- **Data-dependent loop bounds** (`usedInventorySlots`, `effectCount`): genuinely
  unknown; `--loop-cap` remains the only bound. Report them as such.
- **Cross-activation invariants** beyond the Tier-2 provable case: not attempted
  without a fixpoint across activations (out of scope).
- **Correlations not carried by a shared flag cell** (e.g. two branches correlated
  through arithmetic): out of scope — both branches counted (sound).
- **Semantic intent / grouping**: unrecoverable from assembly; reports key on
  labels/cells, not domain names.

### Non-Goals

- No full symbolic execution or SMT solver — Tier 1 is a 3-value flag lattice only.
- No C-source annotation language (comments do not reach the analyzer). If hints are
  ever wanted, the only viable channel is a **sidecar file keyed by assembly label**,
  or parsing `#pragma verboseAssembly` `^`-comment source lines — both fragile,
  both explicitly deferred.
- No change to the fee model or to the Max soundness contract (Max may only get
  *tighter* via feasibility pruning / literal bounds, never below a real execution).

### Acceptance criteria

1. Tier 0+1+3 (no unsound assumptions) reduce the reported **Max** worst single-tx
   activation for `character.contract.smart.c` from ~13.66 toward the measured 2.74,
   and **every** method's Max remains ≥ its measured value (soundness).
2. The **expected** column (Tier 1+2) lands within ±20% of measurement for both a
   combat-dirty method (transferItem 4-effect ≈ 2.74) and combat-clean methods
   (useItem/attack/receiveAttack-pure/plain-deposit ≈ 0.44–0.85).
3. `--measured` mode flags a synthetic `measured > Max` row in a regression test,
   proving the soundness check works.
4. The post-loop `handleDead`+`checkLevelUp` false combination is provably pruned
   (unit test on the assembly fixture: the two are never summed on one path).
5. Un-annotated / unchanged contracts still analyse; Tier 0 constant recovery does
   not alter any current numeric output except via the intended feasibility pruning.

---

## Appendix — Reference measurement harness

The Part 1 numbers were produced by a throwaway Vitest that reused the character
test `lib.ts`/`context.ts` helpers and this meter (the reference for Tier 4):

```ts
// Spy on the simulator's burnBalance: postForgeBlock() calls it once per block
// with executionFee (the block's real gas) before resetting it.
function makeMeter(testbed: any, charAddress: bigint) {
    const bc = testbed.blockchain;
    const burns: bigint[] = [];
    const orig = bc.burnBalance.bind(bc);
    bc.burnBalance = (acc: bigint, amt: bigint) => {
        if (acc === charAddress && amt > 0n) burns.push(amt);
        return orig(acc, amt);
    };
    return (fn: () => void) => {           // returns SIGNA burned by fn()
        const start = burns.length;
        fn();
        const total = burns.slice(start).reduce((s, x) => s + x, 0n);
        return Number(total) / 1e8;
    };
}
```

Worst realistic single-tx activation = **2.74 SIGNA** → recommended
`#program activationAmount` = **3 SIGNA (`300000000`)** (2.74 × ~1.1). Cost scales
~0.2 SIGNA per additional weapon effect; re-measure if the gamemaster registers
weapons with many effects.
