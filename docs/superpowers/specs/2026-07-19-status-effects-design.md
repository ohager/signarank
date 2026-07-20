# Character Status Effects (Combat Pass 2) — Design Spec

**Date:** 2026-07-19
**Status:** Draft (scoped; pending implementation)
**Scope:** `character/character.contract.smart.c` (engine + `COMBAT` handler) and `construct/construct.contract.smart.c` (counter applies a debuff). No gamemaster-registry contract changes — effects reuse the existing registry effect vocabulary.
**Related:** `2026-07-15-construct-combat-design.md` (§ Seam to pass 2), `2026-05-06-gamemaster-registry-design.md`

---

## Goal

Temporary **status effects** — buffs (berserk/rage/adrenaline) and debuffs (weakened/vulnerable) — that live **on the character** for a number of blocks and then expire. Two sources:

- **Item-applied:** a consumable/equipment effect with `MODE_STATUS_EFFECT` (potions, etc.), self-applied via `useItem`/equip.
- **Construct-applied:** the construct's counter inflicts a debuff, bundled with the HP hit via a new `COMBAT(rawDamage, effectId, duration)` message that supersedes plain `DEDUCT_HITPOINTS`.

## Current state (what exists vs. what's missing)

Partial scaffolding is already in the character:
- `applyEffect` handles `MODE_STATUS_EFFECT`: `setMapValue(MAP_KEY1_STATUS_EFFECTS, target, getCurrentBlockheight() + duration)` — an **expiry per target**.

Inert gaps:
- **Nothing reads `MAP_KEY1_STATUS_EFFECTS`** — active effects never modify defense, attack, or the published profile. Status-effect items currently do nothing.
- Stores only the **expiry, not the magnitude** — no way to know how much a stat changes.
- No `COMBAT` message; the construct counter still sends plain `DEDUCT_HITPOINTS`.

---

## Model — one effect per target (decided)

Status effects are keyed by **effect target** (Attack, HP, Strength, Luck, DamageTaken, …). At most **one active status effect per target**; applying a new one to the same target **refreshes/overwrites** (last wins). Bounded by the number of targets (~9), so no key-enumeration problem.

Per target store **effectId + expiry** (two longs — the current `MAP_KEY1_STATUS_EFFECTS` expiry map plus a parallel effectId map, or equivalent). Magnitude is **not** stored; it's looked up from the registry (`bonusAbs`/`bonusRel`/`mode`) via `effectId` at read time — same data-driven source as equipment.

**Lazy consumption (no AT timer):** at every read site, for a target's status slot, if `getCurrentBlockheight() < expiry` the effect is active and its magnitude is folded in; otherwise it's expired and ignored (optionally cleared to reclaim the slot).

**Effective stat =** base attribute + equipment aggregate (`EQUIP_BONUS_*[target]`) + active status effect (if any) for that target. This extends the existing effective-stat computation the combat profile already does.

### Read sites (where effects are folded in)
- **Defense** — `deductHitpoints`: a `DamageTaken` debuff increases the net hit; a defensive buff reduces it. (Character computes this live, so it's always current.)
- **Attack / stats** — `publishCombatProfile`: temporary attack/strength/luck buffs/debuffs fold into the published effective stats the construct reads for damage.
- **Published sheet** — the dApp sees effective (buffed/debuffed) stats.

---

## Phase 1 — Character status-effect engine (core, character-only)

Make `MODE_STATUS_EFFECT` functional end-to-end:
1. On apply, store `effectId` + expiry for the effect's target (overwrite same-target).
2. Add a read-time helper that, given a target, returns the active status contribution (abs/rel) or zero if expired — looking up magnitude from the registry via the stored `effectId`.
3. Fold it into `deductHitpoints` and `publishCombatProfile` (and thus the published sheet).

Self-contained; fully testable character-side (apply a status potion → effective stat changes; advance past expiry → reverts). Makes **item-applied** status effects work. TDD this first.

## Phase 2 — `COMBAT` message on the character

New handler `COMBAT(rawDamage, effectId, duration)`:
- Deduct HP via the existing mitigation path (dodge/armor), **and** apply `effectId` for `duration` blocks via the phase-1 engine.
- `effectId == 0` → pure damage (identical to today's `DEDUCT_HITPOINTS`).
- Gated by the existing `senderIsConstruct` trust check (construct's codehash from the registry).
- Keep `DEDUCT_HITPOINTS` for backward compatibility.

## Phase 3 — Construct applies a counter-debuff

- Gamemaster config `SETCOUNTEREFFECT(effectId, duration)` (0 = none → behaves like today).
- The character-counter path sends `COMBAT(counterDamageBase, counterEffectId, counterEffectDuration)` instead of `DEDUCT_HITPOINTS`.
- Small construct change; budget is tight (~96.7% used, ~341 bytes free) — confirm on compile, factor if needed.

---

## Sources & direction (settled)

- **Buffs** come from **items** (potions the player uses) — a construct never buffs its attacker.
- **Debuffs** come from **constructs** (counter) and possibly cursed items.
- Both flow through the same phase-1 engine and the same registry effect vocabulary.

## Subtleties / open questions

1. **Published-profile staleness.** The construct reads the character's *published* profile, refreshed only on character activation. A character attacks *by* activating (it republishes fresh right then), so the construct reads current effects at attack time; effects that lapse purely by block-passage self-correct on the next activation. Accepted — flag during TDD if a case bites.
2. **Same-target buff+debuff** overwrite (last wins) under the one-per-target model. Acceptable for pass 2; a future N-slot model could let them coexist.
3. **Storage layout** (parallel effectId/expiry maps vs. packing) — fix during TDD phase 1.
4. **Clear-on-expiry vs. leave-stale** — lazy read handles correctness either way; decide whether to actively clear for a clean published sheet.

## Rollout (TDD)

1. ✅ **Phase 1 done (2026-07-19):** engine + read-site integration. `MODE_STATUS_EFFECT` now stores magnitude (`MAP_KEY1_STATUS_ABS`/`_REL`, keys 13/14) alongside the expiry (`MAP_KEY1_STATUS_EFFECTS`, 12); `statusAbs()`/`statusRel()` return the contribution only while `getCurrentBlockheight() < expiry` (lazy). Folded into `publishCombatProfile` (strength/luck/attack abs+rel) and `deductHitpoints` (damage-taken rel = equipment + status). One effect per target; a new effect overwrites. 4 tests: attack-rel buff shows in the published profile; reverts after expiry (forge blocks + republish); flat strength buff; vulnerable debuff raises `landOneHit` net 40→60. Full character suite **158 passed / 1 skipped / 0 failed**. Character 9658/10240 = 94.3%, hash 14368877712615248926. *(Note: the real character codehash changed — the on-chain `G_CHARACTER_HASH` must be updated at deploy; construct tests use the mock stand-in so they're unaffected.)*
2. ✅ **Phase 2 done (2026-07-19):** `COMBAT(rawDamage, effectId, duration)` handler (method 14), in the `senderIsConstruct` dispatch block next to `DEDUCT_HITPOINTS`. Deducts HP via the normal mitigation, then applies a bundled timed status (`storeStatus`, extracted + shared with `MODE_STATUS_EFFECT`) using the **construct-chosen duration** and the effect's registry target/abs/rel. `effectId 0` = pure damage. **Security:** always applied as a *timed status* regardless of the effect's registry mode — a construct can't heal/revive or permanently buff/debuff through COMBAT; skipped if the hit was lethal. `DEDUCT_HITPOINTS` kept for back-compat. 4 tests: effectId-0 pure damage (`landOneCombat` net 40), applies a vulnerable debuff (subsequent hit 40→60), construct-chosen duration expires, trust-gated (non-construct ignored). Full character suite **162 passed / 1 skipped / 0 failed**. Character 9972/10240 = 97.4%, hash 14596734860981725915. *(Registry `bonusRel` is unsigned, so debuffs are positive values on a "bad" target — e.g. DamageTaken +% = vulnerable.)*
3. ✅ **Phase 3 done (2026-07-19):** construct `SETCOUNTEREFFECT(effectId, duration)` (method 20) + `counterEffectId`/`counterEffectDuration` state; the character-counter path now sends `COMBAT(counterDamageBase, counterEffectId, counterEffectDuration)` (method 14) instead of `DEDUCT_HITPOINTS`. Since `COMBAT` with effectId 0 == `DEDUCT_HITPOINTS`, an unconfigured counter behaves exactly as before. 6 construct tests (COMBAT sent with fee, base amount within breach, **bundled effect+duration**, EOA still gets debuff-stack not COMBAT, none when unconfigured, creator-only), stable over 3× full-suite runs: **147 passed / 2 skipped / 0 failed**. Construct 9995/10240 = 97.6%, hash 6956590887210392960.
4. ✅ **Verify:** character 162 / construct 147 green; sizes ≤ 10240. Codehashes — character 14596734860981725915, construct 6956590887210392960. **Pass 2 complete.**
5. ✅ **Size-budget pass (2026-07-19):** both contracts sat at ~97% of the 10240 ceiling. Added `#pragma maxConstVars` (character 10, construct 7) — hoists the most-used numeric literals into reusable const slots instead of re-emitting each immediate load. Pure codegen, semantics unchanged (full repo suite **375 passed / 3 skipped / 0 failed**). `optimizationLevel` was already L3 (verified smallest via the compare script). Chosen at each contract's data-page boundary so deploy cost is unaffected. **Current authoritative codehashes/sizes:** character **8543/10240 = 83.4%**, hash **1923675162148090311**; construct **9237/10240 = 90.2%**, hash **6805910306209244034**. *(These supersede the per-phase hashes above for deploy — set the on-chain `G_CHARACTER_HASH` and the trusted-construct hash on the gamemaster registry to these.)*
