# Construct Combat — Character Ergonomics (Pass 1) — Design Spec

**Date:** 2026-07-15
**Status:** Draft (pending approval; pass 1 of 2)
**Scope:** `construct/construct.contract.smart.c` (+ its `context.ts`/`lib.ts`/tests). **No** character-contract or gamemaster-registry contract changes in this pass.
**Related:** `2026-07-12-registry-as-config-design.md`, `2026-07-14-v2-migration-design.md`, `2026-05-03-character-contract-design.md`, `2026-05-06-gamemaster-registry-design.md`
**Follow-up:** *Character status-effect engine* (pass 2) — bundled `COMBAT` message + effect storage/consumption.

---

## Motivation

The construct today is a pure **EOA** brawler: damage from `SIGNA × ratio` plus stackable power-up tokens (an EOA tx carries up to 4 assets), a counter that *debuffs* the attacker's future SIGNA damage, and a defeat pool distributed to hpToken holders. It has zero awareness of character contracts.

Character contracts can only attach **SIGNA + 1 asset**, so token-stacking doesn't translate. This pass teaches the construct to recognise a character attacker and give it a build-driven combat experience — extra damage from stats and the one carried weapon, luck-scaled item drops, and a real HP-deducting counter — **without touching the EOA path** (backward-compatible) and **without any character/registry contract changes** (everything the character needs already exists).

### Non-Goals (this pass)

- No character-side status effects (buffs/debuffs like berserk/rage). That is pass 2 — see *Seam to pass 2*.
- No new character or gamemaster-registry contract code.
- No change to EOA combat, rewards, cooldown, regeneration, or defeat distribution mechanics themselves — only the *recipient routing* and an additive character branch.

---

## The keystone: character detection

The construct gains a reference to the gamemaster registry and a `senderIsCharacter()` check:

```
senderIsCharacter(sender) =
    let h = getCodeHashOf(sender)
    h != 0 && (h == G_CHARACTER_HASH || h == G_NEXT_CHARACTER_HASH)   // live reads from GAMEMASTER_REGISTRY
```

Both hashes are read **live** from the registry (they already exist there). `G_NEXT_CHARACTER_HASH` is included so mid-migration v2 characters aren't locked out. An EOA's codehash is 0, so it never matches.

**Construct → registry coupling.** The construct needs `GAMEMASTER_REGISTRY`. Sourced registry-as-config style (a `#define GAMEMASTER_REGISTRY`, matching the character), reading `G_CHARACTER_HASH` / `G_NEXT_CHARACTER_HASH` live. The construct also reads the character's public map and the registry's item/effect defs (see *Damage*), reusing the same key constants the character already mirrors.

Everything downstream branches on `senderIsCharacter`. EOA → today's `runAttackerRound()` untouched. Character → the new logic below.

---

## Attacker mode (premium gating)

A gamemaster-set mode enum, checked right after detection:

```
#define ATTACKER_MODE_ANY            0   // default — EOAs and characters both allowed
#define ATTACKER_MODE_CHARACTER_ONLY 1
#define ATTACKER_MODE_EOA_ONLY       2
```

New creator-gated setter `SETATTACKERMODE(mode)`. A rejected attacker (wrong type for the mode) is **refunded, not burned** — same graceful path as the existing "not ready yet" refund. `CHARACTER_ONLY` is the "premium" gate; premium-ness itself comes from what the gamemaster loads behind it (rarer drops, higher XP, exclusive NFT) — config, not code.

*Config-dependency caveat:* if `G_CHARACTER_HASH` is unset, a `CHARACTER_ONLY` construct rejects everyone → inert. Procedural guarantee (dApp should health-check before offering such a construct).

---

## Damage: SIGNA base + published combat profile + consumed element token

**Revised 2026-07-18** — the original "attach the weapon, read its registry effect" model was wrong: an attached token is *transferred* (stuck in the construct, lost). That's correct for a **consumable element token** (spend-to-boost, EOA-style) but fatal for **equipment** (you'd lose your Sword of Fire by swinging it). So the two roles are split, and the equipment/stat contribution is read from the character, never attached.

**Two token roles:**
- **Element token (consumable):** the one asset a character attaches. Transferred/consumed (intended). It amplifies the attack via the construct's existing per-token `DamageAddition`/`DamageMultiplier` maps — the *same* EOA mechanism (`applyTokenModifiers`). Gamemaster-configured per construct.
- **Equipment (persistent):** stays equipped on the character. Its attack contribution reaches the construct through the character's **published combat profile** — no token movement.

**Character publishes an effective-combat profile** (decision: Option B — the character owns how base + equipment (+ future status) combine into effective stats; the construct owns combat tuning). Published to a new public `MAP_KEY1_COMBAT` map on every activation (alongside `publishProgression`):

| key2 | value |
|---|---|
| 1 | effective strength = base strength + `EQUIP_BONUS_ABS[Strength]` |
| 2 | effective luck = base luck + `EQUIP_BONUS_ABS[Luck]` (for step-5 drops) |
| 3 | attack abs = `EQUIP_BONUS_ABS[Attack]` |
| 4 | attack rel = `EQUIP_BONUS_REL[Attack]` |

(level stays in `MAP_KEY1_PROGRESSION[LEVEL]`.) The character already aggregates equipment into `EQUIP_BONUS_ABS/REL[target]` but never consumed it — this publish is that dormant data's first consumer.

**Construct damage for a character attacker:**
```
base      = calculateSignaDamage()                       // SIGNA × baseDamageRatio / 100
statBonus = effStrength × STR_DMG_FACTOR + level × LVL_DMG_FACTOR   // construct-tuned
raw       = (base + statBonus + attackAbs) × (100 + attackRel) / 100
raw       = applyTokenModifiers(raw)                     // consumed element token (EOA-style)
```
then the **existing** `applyBreachLimit()` and defeat-cap apply unchanged.

- effStrength / effLuck / attackAbs / attackRel read from the character's `MAP_KEY1_COMBAT` map; level from `MAP_KEY1_PROGRESSION` — all via `getExtMapValue` on the attacker.
- `STR_DMG_FACTOR` / `LVL_DMG_FACTOR` are gamemaster-configurable via `SETCHARACTERDAMAGE(strFactor, lvlFactor)`, defaults 1/1.
- **Deferred:** a safety net that refunds an accidentally-attached *equipment* token (vs consuming it) — skipped for budget; a character normally won't attach equipped gear.
- **Deferred to pass 2:** effective strength/luck currently sum base + equipment ABS only; % attribute bonuses and status-effect stat mods fold in with the status engine.

*(This supersedes the "no character changes" non-goal below — pass 1 now includes the character publishing its combat profile.)*

### Element affinity (follow-up step, after the profile rework)

**Decided 2026-07-18 (Option 2 — single primary element).** A construct can be weak/strong to an element (e.g. a fire-weak construct vs a Sword of Fire). The element is the weapon's **registry attack effect id** (target=Attack); a character has **one primary attack element** (one weapon).

- **Character** additionally publishes its **primary attack effect id** in the combat profile (the effect id of the equipped attack gear; tracking equip/unequip is the work of this follow-up step).
- **Construct** holds a creator-configured affinity map, `SETEFFECTAFFINITY(effectId, modifier%)`, and applies `affinity[primaryAttackEffectId]` as a **final multiplier** on the character's attack damage (weak = >100, resist = <100, neutral/unset = 100), before `applyBreachLimit()`.
- Multi-element (fire+ice) composition is a possible **pass-2** upgrade.
- **Sequencing:** the combat-profile damage rework lands first (this step); affinity is a separate TDD cycle bolting on the final multiplier + the `primaryAttackEffectId` publish.

✅ **Done (3b).** Character tracks `primaryAttackEffectId` in `applyEffect` (last-equipped attack effect wins; cleared when that same effect unequips) and publishes it at `MAP_KEY1_COMBAT[5]`. Construct `SETEFFECTAFFINITY(15)(effectId, modifier%)` → `MAP_EFFECT_AFFINITY`, applied by `applyElementAffinity()` as the final multiplier in `calculateCharacterDamage` (after `applyTokenModifiers`, before breach cap); unset/0 = neutral, no element = neutral. Character +2 tests (publish + clear-on-unequip); construct +5 tests (weakness, resistance, neutral-unset, only-own-element, stacks-after-stats). Character 8872/10240 (86.6%) hash 6161447366029248743; construct 9487/10240 (92.6%) hash 15436563039184115313.

---

## Reward routing (settled)

The construct's rewards split by **token purpose and recipient**, keyed on whether the sender is a character:

```
rewardRecipient = senderIsCharacter ? getCreatorOf(sender) : sender   // the owner EOA for characters
```

| Reward | EOA sender | Character sender | Rationale |
|---|---|---|---|
| **hpToken** (damage share) | sender | **owner** (`getCreatorOf`) | character bounces unregistered tokens; owner holds it → joins defeat distribution |
| **all SIGNA** (first-blood, final-blow bonuses; defeat pool) | sender | **owner** | every SIGNA reward accrues to the human; `firstBloodAccount`/`finalBlowAccount` store the owner |
| **xpToken** | sender | **character** (the sender) | character *levels* on its XP balance — must stay on the character |
| **item drops** | — | **character** | only a character can inventory/use registered items |

Because owners hold hpToken, the existing `distributeToHolders` defeat mechanism works **unchanged** for both — no separate reward model, and `CHARACTER_ONLY` needs none either. hpToken is dual-use (the construct's HP pool *and* the share receipt); routing the receipt to the owner changes only the holder, not the construct's HP/damage accounting.

*Consistency requirement:* the construct's `xpTokenId` must equal the game's XP token (the registry's `G_XP_TOKEN`) or a character won't recognise the XP it receives. Either keep it a correctly-configured initializer (procedural) or source it registry-as-config in this pass. Lean: source from the registry while we're here.

---

## Item drops (`SETDROPTOKEN`) — single-roll, threshold-band model

Gamemaster-configured, character-only, funded from the construct's own balance.

**Table.** A bounded drop table of up to `MAX_DROP_SLOTS = 5` entries (`slot ∈ 0..4`): `SETDROPTOKEN(slot, tokenId, threshold, quantity)`. `threshold` is a `D100` band (e.g. Rare Sword 2, Potion 15, Shards 30), `quantity` the amount dropped. Drop tokens must be **registered game items** (so the character can inventory them). Setting a slot's token to `0` clears it.

**One roll per attack** (gas: a single `getWeakRandomNumber`, not one per row):

```
roll          = getWeakRandomNumber() D100 (0..99)
effectiveRoll = roll + attackTypeModifier + luckModifier
    attackTypeModifier ∈ { normalHit (default +15), firstBlood (0), finalBlow (default −15) }
    luckModifier       = − luck × LUCK_FACTOR   (default LUCK_FACTOR = 1; luck from the character's public attributes map)
```

Then, for **every** configured slot, drop it iff `effectiveRoll < threshold[slot]`. A low effective roll bundles several items; a high one gets nothing.

**Threshold bands are nested by design.** Because a rare item's threshold sits inside the commoner ones (2 ⊂ 15 ⊂ 30), a rare drop always comes bundled with everything more common — a jackpot roll rewards multiple items. (Intended. This is a bands model, not independent per-item odds.)

**Attack-type precedence.** A one-shot kill is *both* first blood and final blow (technically possible, not expected in practice) — **final blow takes precedence**. Final blow is heavily favoured but **not guaranteed** a drop (a high roll can still whiff).

**Supply guard.** Each hitting slot sends `quantity` to the **character** only if the construct holds it; an emptied slot rewards nothing.

**Configurable knobs** (tuning matters — all gamemaster-settable):
- `SETDROPMODIFIERS(normal, firstBlood, finalBlow)` → defaults `+15 / 0 / −15`.
- `SETLUCKFACTOR(factor)` → default `1` per luck point.
- (`SETDROPTOKEN` per-slot as above.)

*Worked example:* Luck 5, final blow, `roll = 21` → `21 − 15 − 5 = 1` → below all of {2,15,30} → Rare Sword + Potion + Gold Shard. Same roll on a *normal* hit → `21 + 15 − 5 = 31` → above all → nothing.

**On defeat — return unused loot to the creator.** When the construct is defeated, any **remaining drop-token supply** it still holds is returned to the construct's creator (the gamemaster who funded it), not stranded or burned. `handleDefeat()` iterates the drop table and sends each slot's leftover balance (`getAssetBalance(dropToken)`) to `getCreator()`. (The SIGNA burn of the residual balance stays as-is; this only adds token cleanup.)

---

## Counter-attack with HP deduction

The construct's counter already has a chance model (`shouldCounterAttack` / `calculateCounterAttackChance`, scaling with breach severity). This pass adds a *character* branch to what the counter *does*:

- **EOA target:** keep the existing debuff-stack counter (an EOA has no HP).
- **Character target:** send the character its existing `DEDUCT_HITPOINTS` (method `13`) with a counter-damage amount, attaching the character's activation fee (`getActivationOf(sender)`) so the message is picked up. The character applies its own dodge/armor mitigation and may die. No character change — the handler and trust gate (`senderIsConstruct` via the construct's trusted codehash) already exist.
- **Counter damage:** a **gamemaster-configurable** base via `SETCOUNTERDAMAGE(base)` **scaled by breach severity** (how far the incoming hit exceeded the breach limit) — reusing the existing severity signal that already drives counter *chance*.

---

## Seam to pass 2 (status-effect engine)

Buffs/debuffs (berserk/rage/adrenaline, and weakening debuffs) will live **on the character** as temporary effects, applied by the construct. The agreed seam:

- A bundled **`COMBAT(rawDamage, effectId, duration)`** message will *supersede* `DEDUCT_HITPOINTS` — one atomic construct→character call that deducts HP **and** applies a registered gamemaster effect for `duration` blocks (`effectId == 0` = pure damage).
- Effects are **registry effect ids** (same vocabulary as items; magnitude/target data-driven).
- The character will store `(effectId, expiry)` and consume it **lazily at read time** (`getCurrentBlockheight() < expiry`) — no AT timer. Read sites: character defense (`deductHitpoints`), character attack power (the construct reads active effects when computing character damage), and the published sheet.

**Pass-1 stance:** the counter uses plain `DEDUCT_HITPOINTS(13, counterDamage)`. The `COMBAT` message and all effect storage/consumption are pass 2. Pass 1 changes no message *contract* the character depends on beyond the already-supported `DEDUCT_HITPOINTS`.

---

## Backward compatibility

- EOA attack path (`runAttackerRound` and its damage/counter/reward internals) is unchanged; the character branch is additive and detection-gated.
- Default `ATTACKER_MODE_ANY` preserves today's "anyone can attack" behaviour.
- Existing construct tests should stay green; new tests cover the character branch.

---

## Open questions

Settled during design: stat-damage is configurable (`SETCHARACTERDAMAGE`); the drop model is single-roll threshold-bands with configurable modifiers + luck factor, nested bundling intended, final-blow precedence, defeat returns unused loot to the creator; counter damage is configurable (`SETCOUNTERDAMAGE`). Remaining:

1. **Breach-severity scaling curve** for counter damage — exact shape (linear in overage vs stepped). Detail to fix during TDD step 6.
2. **Testbed reads:** confirm the construct can `getExtMapValue` the character's public map and the registry item/effect defs in a multi-contract testbed (expected yes — the character already reads the registry this way, and `getCreatorOf`/`getCodeHashOf` are exercised).

**Settled:** construct `xpTokenId` is **sourced from the registry (`G_XP_TOKEN`)** — single source of truth; a construct can no longer be deployed with a mismatched XP token.

---

## Rollout (TDD)

1. ✅ Construct: add `GAMEMASTER_REGISTRY` ref + `senderIsCharacter()` (live `G_CHARACTER_HASH`/`G_NEXT_CHARACTER_HASH`). *(xpTokenId now registry-sourced; test-infra migrated to `deployConstruct`.)*
2. ✅ `SETATTACKERMODE` + mode gate (refund on reject). Tests: EOA-only rejects character, character-only rejects EOA, any accepts both. *(8 tests green; rejected attackers get a full `refundRejectedAttacker()`; character stand-in via `deployConstructWithCharacter`.)*
3. ✅ Character damage branch — **reworked to the published-profile model** (see the Damage section above). The character publishes an effective-combat profile (`MAP_KEY1_COMBAT`); the construct reads it + level and tunes via `SETCHARACTERDAMAGE(14)` (defaults 1/1); the single attached asset is a consumed element token amplified EOA-style via `applyTokenModifiers`.
   - **Character (6 tests… 4 combat-profile):** publishes effective strength/luck = base + equip, weapon attack abs/rel, on every activation via `publishCombatProfile()` (folded into `publishProgression`, `maxAuxVars` kept at 3). Size 8780/10240, codehash 1237503030798787557. Also hardened a gas-fragile reroll error-log test whose near-zero-balance assumption the extra per-activation gas exposed (intent preserved).
   - **Construct (6 tests):** effective strength×strFactor, level×lvlFactor, weapon attackAbs, weapon attackRel %, breach cap, element-token EOA amplifier. Removed the registry weapon-loop → leaner: **9176/10240 = 89.6%**, codehash 8349792832658085980. `optimizationLevel 3`.
   - Cross-contract `getExtMapValue` into the character's public map confirmed in the multi-contract testbed (resolves open-question #2). `character.mock.contract.smart.c` seeds deterministic published stats.
   - **Next (3b):** element affinity (Option 2) — character publishes primary attack effect id; construct `SETEFFECTAFFINITY` final multiplier.
4. ✅ Reward routing (`getCreatorOf` → owner for hpToken + SIGNA; xp → character). `runAttackerRound` caches `isChar = senderIsCharacter()` and routes the hpToken receipt + `firstBloodAccount` to the owner for characters; `handleDefeat` stores the owner as `finalBlowAccount`. XP always → the attacker. EOA path unchanged. *(4 tests: hpToken→owner (character doesn't hold it), xp→character, EOA unchanged, character final-blow bonus→owner with EOA first-blood preserved. Note: testbed coalesces same-recipient sends per activation — defeat tests use distinct first/final accounts. Construct 9556/10240 = 93.3%, hash 7789060870370273972.)*
5. ✅ `SETDROPTOKEN`(16) 5-slot table + single luck-scaled D100 drop roll + `SETDROPMODIFIERS`(17) (+15/0/−15) + `SETLUCKFACTOR`(18) (default 1); character-only, supply-guarded; `returnUnusedLoot()` returns leftover supply to the creator on defeat. slot+threshold packed into one message arg. *(12 tests, all deterministic via threshold/modifier boundaries — no RNG assertions: guaranteed drop, missed band, nested bands bundle, unfunded/underfunded no-drop, EOA gets none, luck flips a miss to a drop, luck-factor scaling, final-blow favoured, clear slot, defeat returns loot, creator-only.)*
   - **Budget:** the table pushed the construct to 102.2% (over the hard 10240 ceiling). Reclaimed 343 bytes by converting the unrolled 4-asset loops (`returnFundsAndAssets`, `refundPowerUpsWithPenalty`, `applyTokenModifiers`) to real loops — behavior-verified. Now **10124/10240 = 98.9%**, hash 10763713236461752944.
   - **Note:** if defeat bonuses exceed the construct's SIGNA balance, `sendAmount` drains it and the AT halts before the loot return — a gamemaster-config concern (set affordable bonuses), not a contract defect.
   - **Event system removed (2026-07-18):** the `sendEvent*` listener push channel (+ `SETEVENTLISTENER`, `eventListenerAccountId`, `eventBuffer`, and `event-system.test.ts`) was dropped — no real use case, and the info is recoverable from player messages, on-chain state, and tx history. Reclaimed 648 bytes → construct **9476/10240 = 92.5%**, hash 16694697463766696981. Recoverable from git if ever needed.
6. ✅ Counter → `DEDUCT_HITPOINTS`(13) for character targets (fee-attached via `getActivationOf`), debuff-stack retained for EOAs. `counterFires()` shares the breach-severity chance model; `SETCOUNTERDAMAGE`(19) sets the base; `shouldCounterAttack` (EOA) additionally gates on `damageReduction`. *(5 tests: DEDUCT sent with fee, amount = base within breach, EOA gets debuff-stack not DEDUCT, no counter when base unset, creator-only. Deterministic via chance 100 within breach — 0..99 always < 100.)*
   - **Counter-damage curve (open-Q #1) — decided (confirmed by owner): FLAT pre-configured base.** The construct sends the raw `counterDamageBase` — no randomness, no construct-side scaling. The *only* thing that changes the HP a character actually loses is the character's own mitigation (dodge/armor in `deductHitpoints`), computed character-side. Breach severity already scales the counter *chance* (`calculateCounterAttackChance`), so it is deliberately not double-applied to the magnitude. TDD finding that made flat the clear choice: magnitude scaling would only take effect above the breach limit, where the fire chance caps at 90% and the testbed's `getWeakRandomNumber` is non-deterministic across runs — untestable deterministically. "The model does not need to be more complex."
   - **Pre-existing bug fixed:** the counter roll used `getWeakRandomNumber() % 100` (no sign-bit clear); a negative RNG became a huge unsigned value that never satisfied `random < chance`, silently suppressing counters (~half the time) — the cause of the flaky counter/debuff tests. Now `(getWeakRandomNumber() >> 1) % 100`, matching the drop roll and the character's dodge roll. Applies to both character and EOA counters.
   - Construct **9732/10240 = 95.0%**, hash 15316352459712126191.
7. Verify: full construct suite green; compiled size ≤ 10240; record codehash. **Pass 1 complete.**
   - ✅ **Flaky counter/debuff tests hardened (2026-07-19).** Root cause was the *tests*, not the contract: (a) they counted a debuff-*stack increase* as "counter fired", but the stack is a random walk (each hit consumes one, then may add one), so it rarely strictly increases; (b) a fired counter sends a `COUNTER!` short message, but the **testbed concatenates all short messages to one recipient per activation**, so above the breach limit the text is `FIRST BLOOD!…BREACH!…COUNTER!…` and a `startsWith("COUNTER")` check missed it; (c) single-sample assertions on the 90%-capped above-breach chance flaked ~10%; (d) small-`maxHp` configs defeated the construct before enough samples. Rewrote them to detect counters by **substring** (`attackAndDidCounter` / `countCounters` lib helpers), use **survivable** configs (breachLimit 1, `xpSupply ≥ maxHp`), and assert **wide statistical bands** / a large comparative margin (below-breach ≈20% vs above-breach ≈90%). Confirmed stable over 5× full-suite runs: **146 passed / 2 skipped / 0 failed.** (The earlier sign-bit fix in `counterFires` was still necessary — it's what makes the RNG comparison correct.)
   - ✅ **XP-shortage gap fixed (2026-07-19):** the construct pays XP equal to damage dealt, so `main()` now guards each attacker activation — if `getAssetBalance(xpTokenId) < getCurrentHitpoints()` it can't cover the remaining HP, so `handleXpShortage()` deactivates (`isActive = 0`), warns the creator ("XP Token Shortage"), and refunds the attacker. Well-funded constructs (`xpSupply == maxHp`) never trip it — XP and hpToken decrement by the same damage each hit. Full construct suite now **146 passed / 2 skipped / 0 failed** across repeated runs. Construct **9899/10240 = 96.7%**, hash 118431264994620112.
   - ✅ **Size-budget pass (2026-07-19):** added `#pragma maxConstVars 7`, which hoists the most-used numeric literals into reusable const slots instead of re-emitting each immediate load. Pure codegen (semantics unchanged; full suite still **375 passed / 3 skipped** repo-wide). `optimizationLevel` was already at L3 (verified smallest). 7 is the max value before an 8th data page is needed, so deploy cost is unchanged (DataPages=7). Construct **9237/10240 = 90.2%** (−758 bytes), new codehash **6805910306209244034**. *(Codehash changed — the trusted-construct hash on the gamemaster registry must be set to this at deploy.)*
