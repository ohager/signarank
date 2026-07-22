# Client Library — Character Concept — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the Character concept into `@signarank/client` (read + owner-write via an injected `Signer`), backed by small character-contract publish-schema additions and an extended gamemaster-registry read service.

**Architecture:** Part 1 adds published maps to the character contract (`VITALS`, effective sta/dex/will in `COMBAT`, `STATUS_EFFECT_ID`) so state is robustly cross-contract readable. Part 2 adds a single `Character` class (read + optional write) to `@signarank/client`, extends `GamemasterRegistryReadService`, and folds discovery into `Player` via the char-account registry. One writer (the owner EOA) + inbound construct messages; no gamemaster write side, no read/write-instance split.

**Tech Stack:** SmartC / CIYAM AT + `signum-smartc-testbed` (Part 1, repo `signarank/smartcontracts`, vitest); TypeScript / `@signumjs/*` / `bun:test` / Turborepo + Changesets (Part 2, repo `signarank-constructor`).

**Spec:** `signarank/docs/superpowers/specs/2026-07-19-client-character-design.md`

**Two repos — set the working directory per phase:**
- Phase 1 → `/Users/oliverhager/Code/signum/signarank/smartcontracts`
- Phases 2–7 → `/Users/oliverhager/Code/signum/signarank-constructor` (transition branch; do not touch `main`)

**Key values fixed by this plan** (mirror everywhere they appear):
- New map key1: `MAP_KEY1_STATUS_EFFECT_ID = 15`, `MAP_KEY1_VITALS = 16`.
- `COMBAT` k2: Strength 1, Luck 2, AttackAbs 3, AttackRel 4, AttackEffect 5, **Stamina 6, Dexterity 7, Willpower 8**.
- `VITALS` k2: **CurrentHp 1, MaxHp 2, IsDead 3**.
- Effect targets (from the registry enum): Strength 2, Stamina 3, Dexterity 4, Luck 5, Willpower 6.
- Attribute map indices (1-indexed): Strength 1, Stamina 2, Dexterity 3, Luck 4, Willpower 5.

---

## File Structure

**Part 1 — `signarank/smartcontracts/character/`**
- Modify `character.contract.smart.c` — add defines, `publishVitals()`, extend `publishCombatProfile()`, add `effectId` to `storeStatus()`.
- Modify `context.ts` — add `Maps.Vitals`, `Maps.StatusEffectId`, `VitalsKeys`, extend `CombatKeys`.
- Modify `lib.ts` — add `getVitals()`, `getStatusEffectId()` helpers.
- Test: extend `combat-profile/combat-profile.test.ts`; new `vitals/vitals.test.ts`; extend `status-effects/status-effects.test.ts`; existing `compile.test.ts` gate.

**Part 2 — `signarank-constructor/packages/`**
- `services/src/gamemaster-registry/gamemaster-registry.constants.ts` — add `+3..+6` globals + method ids.
- `services/src/gamemaster-registry/gamemaster-registry.read.service.ts` — add global read methods.
- `services/src/gamemaster-registry/gamemaster-registry.read.service.test.ts` — new.
- `services/src/character/character.constants.ts` — new (mirror character contract keys).
- `services/src/character/character.service.context.ts` — new.
- `services/src/character/index.ts` — new.
- `client/src/character.ts` — new (`Character` class).
- `client/src/character.types.ts` — new (typed sheet records).
- `client/src/character.test.ts` — new.
- `client/src/readOnlyPlayer.ts` — add `getCharacters()` / `character()` + context field.
- `client/src/player.ts` — add write-enabled `character()`.
- `client/src/index.ts` — export `Character` + types.
- `.changeset/<name>.md` — new; version bump.

---

## PART 1 — Character contract publish-schema (repo: `signarank/smartcontracts`)

### Task 1: Add the `VITALS` published map

**Files:**
- Modify: `character/character.contract.smart.c`
- Modify: `character/context.ts`
- Modify: `character/lib.ts`
- Test: `character/vitals/vitals.test.ts` (create)

- [ ] **Step 1: Add context + lib helpers**

In `character/context.ts`, add to the `Maps` object:
```ts
        StatusEffectId: 15n,
        Vitals: 16n,
```
Add a new top-level entry after `CombatKeys`:
```ts
    // key2 sub-ids under Maps.Vitals — mirror MAP_KEY2_VITALS_* .
    VitalsKeys: {
        CurrentHp: 1n,
        MaxHp: 2n,
        IsDead: 3n,
    },
```
In `character/lib.ts`, add:
```ts
export function getVitals(testbed: SimulatorTestbed, vitalsKey2: bigint, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.Vitals, vitalsKey2, address) ?? 0n;
}
```

- [ ] **Step 2: Write the failing test**

Create `character/vitals/vitals.test.ts`:
```ts
import {describe, expect, test} from "vitest";
import {deployCharacter, getVitals, landOneCombat, deployCharacterWithTrustedConstruct} from "../lib";
import {Context} from "../context";

describe("Character VITALS map", () => {
    test("publishes currentHp, maxHp and isDead at deploy", () => {
        const {testbed} = deployCharacter();
        const maxHp = getVitals(testbed, Context.VitalsKeys.MaxHp);
        expect(maxHp).toBeGreaterThan(0n);
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBe(maxHp); // full HP at spawn
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(0n);
    });

    test("currentHp drops after a combat hit and isDead flips on death", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        const maxHp = getVitals(testbed, Context.VitalsKeys.MaxHp);
        landOneCombat(testbed, constructAddress, 5n); // small survivable hit
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBeLessThan(maxHp);
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(0n);

        landOneCombat(testbed, constructAddress, maxHp + 1000n); // lethal
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBe(0n);
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(1n);
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun vitest run character/vitals/vitals.test.ts`
Expected: FAIL — `getVitals` returns `0n` (map never written).

- [ ] **Step 4: Implement in the contract**

In `character.contract.smart.c`, add near the other map-key defines:
```c
#define MAP_KEY1_STATUS_EFFECT_ID 15
#define MAP_KEY1_VITALS 16
#define MAP_KEY2_VITALS_CURRENT_HP 1
#define MAP_KEY2_VITALS_MAX_HP 2
#define MAP_KEY2_VITALS_IS_DEAD 3
```
Add the publisher:
```c
// Live combat-state sheet (cross-contract readable). currentHitpoints is not
// derivable off-chain; maxHitpoints published for self-containment; isDead flag.
void publishVitals() {
    setMapValue(MAP_KEY1_VITALS, MAP_KEY2_VITALS_CURRENT_HP, currentHitpoints);
    setMapValue(MAP_KEY1_VITALS, MAP_KEY2_VITALS_MAX_HP, maxHitpoints);
    setMapValue(MAP_KEY1_VITALS, MAP_KEY2_VITALS_IS_DEAD, isDead);
}
```
In `publishProgression()`, call it right after `publishCombatProfile();`:
```c
    publishCombatProfile();
    publishVitals();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun vitest run character/vitals/vitals.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/oliverhager/Code/signum/signarank/smartcontracts
git add character/character.contract.smart.c character/context.ts character/lib.ts character/vitals/vitals.test.ts
git commit -m "feat(character): publish VITALS map (currentHp/maxHp/isDead)"
```

---

### Task 2: Extend `COMBAT` with effective stamina/dexterity/willpower

**Files:**
- Modify: `character/character.contract.smart.c`
- Modify: `character/context.ts`
- Test: `character/combat-profile/combat-profile.test.ts`

- [ ] **Step 1: Add context keys**

In `character/context.ts`, extend `CombatKeys`:
```ts
        AttackEffect: 5n, // primary attack effect id (element) for construct affinity
        Stamina: 6n,      // effective stamina (base + equip + status)
        Dexterity: 7n,    // effective dexterity
        Willpower: 8n,    // effective willpower
```

- [ ] **Step 2: Write the failing test**

Append to `character/combat-profile/combat-profile.test.ts`:
```ts
describe("effective stamina/dexterity/willpower", () => {
    test("publishes effective stamina/dex/will = base + equipment aggregate", () => {
        // A ring granting +3 Stamina (AggregateAbs on target Stamina=3).
        const staminaRingEffect = 501n;
        const {testbed} = deployCharacterWithEquip({ // helper already used in this file
            logicalEffectId: staminaRingEffect,
            target: Context.EffectTarget.Stamina,
            mode: Context.EffectMode.AggregateAbs,
            bonusAbs: 3n,
        });
        const baseStamina = getAttr(testbed, Context.Attrs.Stamina);
        expect(getPublicCombat(testbed, Context.CombatKeys.Stamina)).toBe(baseStamina + 3n);
        // dex/will with no equipment == their base attribute value
        expect(getPublicCombat(testbed, Context.CombatKeys.Dexterity)).toBe(getAttr(testbed, Context.Attrs.Dexterity));
        expect(getPublicCombat(testbed, Context.CombatKeys.Willpower)).toBe(getAttr(testbed, Context.Attrs.Willpower));
    });
});
```
NOTE: reuse whatever equip-deploy helper `combat-profile.test.ts` already imports (e.g. `getAttr`, `getPublicCombat`, and its existing equip helper). If it lacks an equip helper, use the existing `registerEffectOnGamemasterRegistry` + `registerItemOnGamemasterRegistry` + `setItemEffectOnGamemasterRegistry` + equip-deposit flow already present in the file's other tests, matching their setup exactly.

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun vitest run character/combat-profile/combat-profile.test.ts`
Expected: FAIL — `getPublicCombat(..., Stamina)` returns `0n`.

- [ ] **Step 4: Implement in the contract**

In `character.contract.smart.c`, add the target defines next to the existing `EQUIP_TARGET_*`:
```c
#define EQUIP_TARGET_STAMINA          3
#define EQUIP_TARGET_DEXTERITY        4
#define EQUIP_TARGET_WILLPOWER        6
```
Add the combat-profile k2 defines next to the existing `MAP_KEY2_COMBAT_*`:
```c
#define MAP_KEY2_COMBAT_STAMINA        6
#define MAP_KEY2_COMBAT_DEXTERITY      7
#define MAP_KEY2_COMBAT_WILLPOWER      8
```
In `publishCombatProfile()`, before the final `setMapValue(... ATTACK_EFFECT ...)`, add three decomposed blocks (mirroring the existing strength/luck blocks, staying within `maxAuxVars`):
```c
    base = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_STAMINA);
    equip = getMapValue(MAP_KEY1_EQUIP_BONUS_ABS, EQUIP_TARGET_STAMINA);
    base = base + equip;
    equip = statusAbs(EQUIP_TARGET_STAMINA);
    base = base + equip;
    setMapValue(MAP_KEY1_COMBAT, MAP_KEY2_COMBAT_STAMINA, base);

    base = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_DEXTERITY);
    equip = getMapValue(MAP_KEY1_EQUIP_BONUS_ABS, EQUIP_TARGET_DEXTERITY);
    base = base + equip;
    equip = statusAbs(EQUIP_TARGET_DEXTERITY);
    base = base + equip;
    setMapValue(MAP_KEY1_COMBAT, MAP_KEY2_COMBAT_DEXTERITY, base);

    base = getMapValue(MAP_KEY1_ATTRIBUTES, MAP_KEY2_ATTRIBUTES_WILLPOWER);
    equip = getMapValue(MAP_KEY1_EQUIP_BONUS_ABS, EQUIP_TARGET_WILLPOWER);
    base = base + equip;
    equip = statusAbs(EQUIP_TARGET_WILLPOWER);
    base = base + equip;
    setMapValue(MAP_KEY1_COMBAT, MAP_KEY2_COMBAT_WILLPOWER, base);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun vitest run character/combat-profile/combat-profile.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add character/character.contract.smart.c character/context.ts character/combat-profile/combat-profile.test.ts
git commit -m "feat(character): publish effective stamina/dexterity/willpower in COMBAT"
```

---

### Task 3: Store `effectId` per active status (`STATUS_EFFECT_ID`)

**Files:**
- Modify: `character/character.contract.smart.c`
- Modify: `character/lib.ts`
- Test: `character/status-effects/status-effects.test.ts`

- [ ] **Step 1: Add lib helper**

In `character/lib.ts`, add:
```ts
export function getStatusEffectId(testbed: SimulatorTestbed, target: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.StatusEffectId, target, Context.CharacterAddress) ?? 0n;
}
```

- [ ] **Step 2: Write the failing test**

Append to `character/status-effects/status-effects.test.ts` (reuse the file's existing status-effect setup helpers/imports):
```ts
test("stores the source effectId per target when a status effect is applied", () => {
    // Reuse the file's existing pattern: register a MODE_STATUS_EFFECT consumable
    // targeting DamageTaken, deposit + useItem it, then assert the id is stored.
    const logical = 700n;
    const {testbed, tokenId, physicalEffectId} = applyStatusPotion({ // existing helper in this file
        logicalEffectId: logical,
        target: Context.EffectTarget.DamageTaken,
        bonusRel: 50n,
        duration: 20n,
    });
    expect(getStatusEffectId(testbed, Context.EffectTarget.DamageTaken)).toBe(physicalEffectId);
});
```
NOTE: match the file's actual helper (e.g. how it registers+applies a status effect and how it computes the physical effectId via `effectId(logical)`); if there is no single helper, inline the same register/deposit/useItem steps the neighbouring tests use, and compute the expected id with `effectId(logical)`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun vitest run character/status-effects/status-effects.test.ts`
Expected: FAIL — `getStatusEffectId` returns `0n`.

- [ ] **Step 4: Implement in the contract**

Change `storeStatus` to take the `effectId` and write it. New signature + body:
```c
// Stores a timed status effect for a target (identity + magnitude + expiry),
// overwriting any prior effect on that target. duration is in blocks from now.
void storeStatus(long target, long effectId, long abs, long rel, long duration) {
    setMapValue(MAP_KEY1_STATUS_EFFECTS, target, getCurrentBlockheight() + duration);
    setMapValue(MAP_KEY1_STATUS_EFFECT_ID, target, effectId);
    setMapValue(MAP_KEY1_STATUS_ABS, target, abs);
    setMapValue(MAP_KEY1_STATUS_REL, target, rel);
}
```
Update the two callers to pass `effectId`:
- In `applyEffect()`, MODE_STATUS_EFFECT branch:
```c
    } else if(mode == MODE_STATUS_EFFECT){
        storeStatus(target, effectId, bonusAbs, bonusRel, duration);
        return 1;
    }
```
- In `combat()`:
```c
        storeStatus(target, effectId, abs, rel, duration);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun vitest run character/status-effects/status-effects.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add character/character.contract.smart.c character/lib.ts character/status-effects/status-effects.test.ts
git commit -m "feat(character): store source effectId per active status (STATUS_EFFECT_ID)"
```

---

### Task 4: Size gate, full suite, record new codehash

**Files:**
- Test: `character/compile.test.ts` (existing), full character suite.

- [ ] **Step 1: Run the size gate**

Run: `bun vitest run character/compile.test.ts`
Expected: PASS — code size ≤ 10240 (ample headroom post `maxConstVars 10`).

- [ ] **Step 2: Run the full character suite**

Run: `bun vitest run character/`
Expected: PASS — all green (previously-passing tests unaffected; new maps additive).

- [ ] **Step 3: Capture the new codehash**

Run: `bun /Users/oliverhager/.claude/skills/signum-smartc/scripts/compile.js character/character.contract.smart.c`
Record the printed `Machine Hash ID`. This is the value that must be set as `G_CHARACTER_HASH` on the gamemaster registry and as the trusted character hash on the char-account registry at deploy.

- [ ] **Step 4: Update the spec's deployment note + commit**

Append the captured codehash to the "Deployment notes" section of `docs/superpowers/specs/2026-07-19-client-character-design.md` (in the `signarank` repo root, not smartcontracts):
```bash
cd /Users/oliverhager/Code/signum/signarank
git add docs/superpowers/specs/2026-07-19-client-character-design.md
git commit -m "docs: record new character codehash after publish-schema additions"
```

---

## PART 2 — Client library (repo: `signarank-constructor`, transition branch)

> Test runner is `bun test` (existing service tests use `bun:test`). Run tests from the monorepo root: `/Users/oliverhager/Code/signum/signarank-constructor`.

### Task 5: Extend `GamemasterRegistryReadService` with the missing globals

**Files:**
- Modify: `packages/services/src/gamemaster-registry/gamemaster-registry.constants.ts`
- Modify: `packages/services/src/gamemaster-registry/gamemaster-registry.read.service.ts`
- Test: `packages/services/src/gamemaster-registry/gamemaster-registry.read.service.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `gamemaster-registry.read.service.test.ts`:
```ts
import { test, expect, describe, mock, beforeEach } from "bun:test";
import { GamemasterRegistryReadService } from "./gamemaster-registry.read.service";
import { Globals } from "./gamemaster-registry.constants";
import type { GamemasterRegistryServiceContext } from "./gamemaster-registry.service.context";
import type { ReadOnlyLedger } from "@signumjs/core";

describe("GamemasterRegistryReadService globals", () => {
  let service: GamemasterRegistryReadService;
  let byKey: Record<string, string>;

  beforeEach(() => {
    byKey = {
      [Globals.XpToken]: "2001",
      [Globals.ConstructorAccount]: "42",
      [Globals.CharRegistry]: "122344543655",
      [Globals.NextCharacterHash]: "0",
    };
    const mockLedger: any = {
      contract: {
        getSingleContractMapValue: mock(({ key1 }: { key1: string }) =>
          Promise.resolve({ value: byKey[key1] ?? "0" })
        ),
      },
    };
    const ctx: GamemasterRegistryServiceContext<ReadOnlyLedger> = {
      ledger: mockLedger,
      contractId: "122344543654",
    };
    service = new GamemasterRegistryReadService(ctx);
  });

  test("reads xp token, constructor account and char registry", async () => {
    expect(await service.getXpToken()).toBe("2001");
    expect(await service.getConstructorAccount()).toBe("42");
    expect(await service.getCharRegistry()).toBe("122344543655");
  });

  test("migration window is closed when next character hash is 0", async () => {
    expect(await service.getNextCharacterHash()).toBe("0");
    expect(await service.isMigrationWindowOpen()).toBe(false);
  });

  test("migration window is open when next character hash is set", async () => {
    byKey[Globals.NextCharacterHash] = "99887766";
    expect(await service.isMigrationWindowOpen()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/services/src/gamemaster-registry/gamemaster-registry.read.service.test.ts`
Expected: FAIL — `Globals.XpToken` undefined + methods missing.

- [ ] **Step 3: Add the constants**

In `gamemaster-registry.constants.ts`, extend `Globals`:
```ts
export const Globals = {
    ConstructHash:      (RegistryBase + 1n).toString(10),
    CharacterHash:      (RegistryBase + 2n).toString(10),
    XpToken:            (RegistryBase + 3n).toString(10),
    ConstructorAccount: (RegistryBase + 4n).toString(10),
    CharRegistry:       (RegistryBase + 5n).toString(10),
    NextCharacterHash:  (RegistryBase + 6n).toString(10),
    LevelThreshold:     (RegistryBase + 10n).toString(10),
    ErrorLog:           (RegistryBase + 99n).toString(10),
} as const;
```
Extend `MethodId` with the missing setters (for admin-service parity):
```ts
export enum MethodId {
    SetConstructHash      = 1,
    SetCharacterHash      = 2,
    SetLevelThreshold     = 3,
    SetXpToken            = 4,
    SetConstructorAccount = 5,
    SetCharRegistry       = 6,
    SetNextCharacterHash  = 7,
    RegisterItem          = 10,
    UnregisterItem        = 11,
    SetItemEffect         = 12,
    RegisterEffect        = 20,
    UnregisterEffect      = 21,
}
```

- [ ] **Step 4: Add the read methods**

In `gamemaster-registry.read.service.ts`, add next to `getCharacterHash()`:
```ts
    async getXpToken(): Promise<string> {
        return this._readGlobal(Globals.XpToken);
    }

    async getConstructorAccount(): Promise<string> {
        return this._readGlobal(Globals.ConstructorAccount);
    }

    async getCharRegistry(): Promise<string> {
        return this._readGlobal(Globals.CharRegistry);
    }

    async getNextCharacterHash(): Promise<string> {
        return this._readGlobal(Globals.NextCharacterHash);
    }

    /** True when the Gamemaster has opened a migration window (next hash set). */
    async isMigrationWindowOpen(): Promise<boolean> {
        const hash = await this.getNextCharacterHash();
        return hash !== "0" && hash !== "";
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test packages/services/src/gamemaster-registry/gamemaster-registry.read.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/oliverhager/Code/signum/signarank-constructor
git add packages/services/src/gamemaster-registry
git commit -m "feat(services): read xp/constructor/char-registry/next-hash globals + migration window"
```

---

### Task 6: Character service constants + context

**Files:**
- Create: `packages/services/src/character/character.constants.ts`
- Create: `packages/services/src/character/character.service.context.ts`
- Create: `packages/services/src/character/index.ts`
- Test: `packages/services/src/character/character.constants.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `character.constants.test.ts`:
```ts
import { test, expect, describe } from "bun:test";
import { CharacterMaps, CombatKeys, VitalsKeys, CharacterMethod, ConstructMethod } from "./character.constants";

describe("character.constants", () => {
  test("map keys mirror the contract", () => {
    expect(CharacterMaps.Attributes).toBe("1");
    expect(CharacterMaps.Progression).toBe("3");
    expect(CharacterMaps.Combat).toBe("4");
    expect(CharacterMaps.StatusEffects).toBe("12");
    expect(CharacterMaps.StatusEffectId).toBe("15");
    expect(CharacterMaps.Vitals).toBe("16");
  });
  test("combat + vitals sub-keys", () => {
    expect(CombatKeys.Willpower).toBe("8");
    expect(VitalsKeys.CurrentHp).toBe("1");
    expect(VitalsKeys.IsDead).toBe("3");
  });
  test("method codes", () => {
    expect(CharacterMethod.Attack).toBe(2);
    expect(ConstructMethod.ReceiveAttack).toBe(13);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/services/src/character/character.constants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the constants**

Create `character.constants.ts`:
```ts
/**
 * Mirror of the on-chain Character contract public map layout.
 * Keep in sync with `smartcontracts/character/character.contract.smart.c`.
 */

// KKV map key1 values (as decimal strings for ledger map reads).
export const CharacterMaps = {
    Attributes:     "1",
    Inventory:      "2",
    Progression:    "3",
    Combat:         "4",
    EquipBonusAbs:  "10",
    EquipBonusRel:  "11",
    StatusEffects:  "12",
    StatusAbs:      "13",
    StatusRel:      "14",
    StatusEffectId: "15",
    Vitals:         "16",
    ErrorCode:      "20",
    ErrorTxid:      "21",
    ErrorMeta:      "22",
} as const;

// key2 sub-ids
export const AttributeKeys = { Strength: "1", Stamina: "2", Dexterity: "3", Luck: "4", Willpower: "5" } as const;
export const ProgressionKeys = { Level: "1", SkillPoints: "2" } as const;
export const CombatKeys = {
    Strength: "1", Luck: "2", AttackAbs: "3", AttackRel: "4", AttackEffect: "5",
    Stamina: "6", Dexterity: "7", Willpower: "8",
} as const;
export const VitalsKeys = { CurrentHp: "1", MaxHp: "2", IsDead: "3" } as const;

// Effect target enum (registry) — used to interpret status/equip collections.
export enum EffectTarget {
    Attack = 0, HP = 1, Strength = 2, Stamina = 3, Dexterity = 4,
    Luck = 5, Willpower = 6, InvSlots = 7, DamageTaken = 8,
}

// Owner-facing method codes (message[0]).
export enum CharacterMethod {
    AllocateSkillpoint = 1, Attack = 2, Reroll = 3, TransferItem = 4,
    UseItem = 5, Seppuku = 66, Migrate = 77, Refund = 99,
}

// Construct→character method codes (never sent by the client).
export enum ConstructMethod { ReceiveAttack = 13 }

// Player-attribute selector for allocateSkillPoint (1-indexed, matches the map).
export enum AttributeId { Strength = 1, Stamina = 2, Dexterity = 3, Luck = 4, Willpower = 5 }

// Economy constants — mirror the contract #defines.
export const RerollCostsPlanck = "10000000000"; // 100 SIGNA (REROLL_COSTS)
export const MaxRerolls = 5;
export const MaxCharactersPerAccount = 5;
export const CharRegistryCounterKey2 = "0"; // reserved (creator,0) counter slot
```

- [ ] **Step 4: Create the context + index**

Create `character.service.context.ts`:
```ts
import type { ReadOnlyLedger, StandardLedger } from "@signumjs/core";
import type { Signer } from "@signarank/common/signer";

export type CharacterServiceContext<TLedger extends ReadOnlyLedger | StandardLedger> = {
    ledger: TLedger;
    /** Deployed Gamemaster Registry account id (single source of truth). */
    gamemasterRegistryId: string;
};

export type CharacterWriteContext = CharacterServiceContext<StandardLedger> & {
    signer: Signer;
};
```
Create `index.ts`:
```ts
export * from "./character.constants";
export * from "./character.service.context";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test packages/services/src/character/character.constants.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/character
git commit -m "feat(services): add character constants + service context"
```

---

### Task 7: `Character` reads — scalar sheets (vitals/progression/attributes/combat)

**Files:**
- Create: `packages/client/src/character.types.ts`
- Create: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts` (create)

- [ ] **Step 1: Define the typed records**

Create `character.types.ts`:
```ts
export interface Attributes {
    strength: number; stamina: number; dexterity: number; luck: number; willpower: number;
}
export interface Progression { level: number; skillPoints: number; }
export interface Vitals { currentHp: number; maxHp: number; isDead: boolean; }
export interface CombatProfile {
    strength: number; luck: number; stamina: number; dexterity: number; willpower: number;
    attackAbs: number; attackRel: number; attackEffectId: string;
}
export interface InventoryItem {
    tokenId: string; name: string; quantity: number;
    itemType: number; effects: string[];
}
export interface Condition {
    target: number; effectId: string; abs: number; rel: number;
    expiryBlock: number; blocksRemaining: number;
}
export interface CharacterError { slot: number; code: number; txId: string; }
export interface InternalState { rerollCount: number; committed: boolean; migrated: boolean; }
export interface CharacterSheet {
    characterId: string;
    attributes: Attributes;
    combat: CombatProfile;
    progression: Progression;
    vitals: Vitals;
    inventory: InventoryItem[];
    conditions: Condition[];
}
```

- [ ] **Step 2: Write the failing test**

Create `character.test.ts`:
```ts
import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Character } from "./character";

const CHAR_ID = "123456";

function mapReader(store: Record<string, Record<string, string>>) {
  return {
    getContractMapValuesByFirstKey: mock(({ key1 }: { key1: string }) =>
      Promise.resolve({ keyValues: Object.entries(store[key1] ?? {}).map(([key2, value]) => ({ key2, value })) })
    ),
    getSingleContractMapValue: mock(({ key1, key2 }: { key1: string; key2: string }) =>
      Promise.resolve({ value: store[key1]?.[key2] ?? "0" })
    ),
  };
}

describe("Character reads — scalar sheets", () => {
  let ledger: any;
  beforeEach(() => {
    ledger = {
      contract: mapReader({
        "1":  { "1": "5", "2": "4", "3": "3", "4": "2", "5": "1" },     // attributes
        "3":  { "1": "7", "2": "2" },                                   // progression: lvl 7, skill 2
        "4":  { "1": "8", "2": "3", "3": "10", "4": "25", "5": "700100", "6": "4", "7": "3", "8": "1" }, // combat
        "16": { "1": "80", "2": "170", "3": "0" },                      // vitals
      }),
      block: { getBlockById: mock(() => Promise.resolve({ height: 1000 })) },
    };
  });

  test("getVitals", async () => {
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    expect(await c.getVitals()).toEqual({ currentHp: 80, maxHp: 170, isDead: false });
  });

  test("getProgression + getAttributes", async () => {
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    expect(await c.getProgression()).toEqual({ level: 7, skillPoints: 2 });
    expect(await c.getAttributes()).toEqual({ strength: 5, stamina: 4, dexterity: 3, luck: 2, willpower: 1 });
  });

  test("getCombatProfile", async () => {
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    expect(await c.getCombatProfile()).toEqual({
      strength: 8, luck: 3, attackAbs: 10, attackRel: 25, attackEffectId: "700100",
      stamina: 4, dexterity: 3, willpower: 1,
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the scalar reads**

Create `character.ts`:
```ts
import type { ReadOnlyLedger, StandardLedger } from "@signumjs/core";
import type { Signer } from "@signarank/common/signer";
import { withError } from "@signarank/common/withError";
import {
    CharacterMaps, AttributeKeys, ProgressionKeys, CombatKeys, VitalsKeys,
} from "@signarank/services/character";
import type { IStorage } from "./storage";
import { MemoryStorage } from "./storage";
import type { Attributes, Progression, Vitals, CombatProfile } from "./character.types";

export type CharacterContext = {
    ledger: ReadOnlyLedger | StandardLedger;
    characterId: string;
    gamemasterRegistryId: string;
    signer?: Signer;
    cache?: IStorage<unknown>;
};

export class Character {
    protected readonly ledger: ReadOnlyLedger;
    readonly characterId: string;
    protected readonly gamemasterRegistryId: string;
    protected readonly signer?: Signer;
    protected readonly cache: IStorage<unknown>;

    constructor(protected readonly context: CharacterContext) {
        this.ledger = context.ledger as ReadOnlyLedger;
        this.characterId = context.characterId;
        this.gamemasterRegistryId = context.gamemasterRegistryId;
        this.signer = context.signer;
        this.cache = context.cache ?? new MemoryStorage<unknown>();
    }

    private async _mapByK1(key1: string): Promise<Map<string, string>> {
        const { keyValues } = await this.ledger.contract.getContractMapValuesByFirstKey({
            contractId: this.characterId, key1,
        });
        return new Map((keyValues ?? []).map(kv => [kv.key2, kv.value]));
    }

    async getVitals(): Promise<Vitals> {
        return withError(async () => {
            const m = await this._mapByK1(CharacterMaps.Vitals);
            return {
                currentHp: Number(m.get(VitalsKeys.CurrentHp) ?? "0"),
                maxHp: Number(m.get(VitalsKeys.MaxHp) ?? "0"),
                isDead: (m.get(VitalsKeys.IsDead) ?? "0") === "1",
            };
        });
    }

    async getProgression(): Promise<Progression> {
        return withError(async () => {
            const m = await this._mapByK1(CharacterMaps.Progression);
            return {
                level: Number(m.get(ProgressionKeys.Level) ?? "0"),
                skillPoints: Number(m.get(ProgressionKeys.SkillPoints) ?? "0"),
            };
        });
    }

    async getAttributes(): Promise<Attributes> {
        return withError(async () => {
            const m = await this._mapByK1(CharacterMaps.Attributes);
            return {
                strength: Number(m.get(AttributeKeys.Strength) ?? "0"),
                stamina: Number(m.get(AttributeKeys.Stamina) ?? "0"),
                dexterity: Number(m.get(AttributeKeys.Dexterity) ?? "0"),
                luck: Number(m.get(AttributeKeys.Luck) ?? "0"),
                willpower: Number(m.get(AttributeKeys.Willpower) ?? "0"),
            };
        });
    }

    async getCombatProfile(): Promise<CombatProfile> {
        return withError(async () => {
            const m = await this._mapByK1(CharacterMaps.Combat);
            return {
                strength: Number(m.get(CombatKeys.Strength) ?? "0"),
                luck: Number(m.get(CombatKeys.Luck) ?? "0"),
                attackAbs: Number(m.get(CombatKeys.AttackAbs) ?? "0"),
                attackRel: Number(m.get(CombatKeys.AttackRel) ?? "0"),
                attackEffectId: m.get(CombatKeys.AttackEffect) ?? "0",
                stamina: Number(m.get(CombatKeys.Stamina) ?? "0"),
                dexterity: Number(m.get(CombatKeys.Dexterity) ?? "0"),
                willpower: Number(m.get(CombatKeys.Willpower) ?? "0"),
            };
        });
    }
}
```
Add `"@signarank/services/character"` to the services package `exports`/subpath if the monorepo uses explicit subpath exports (mirror how `@signarank/services/construct` is exported); otherwise the workspace alias resolves it directly. Confirm by matching the existing `construct` subpath export config.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.types.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character scalar reads (vitals/progression/attributes/combat)"
```

---

### Task 8: `Character.getInventory` — resolve slots to items

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
describe("Character.getInventory", () => {
  test("groups per-unit slots into stacks and resolves item metadata", async () => {
    const ledger: any = {
      contract: mapReader({
        // inventory: slots 0,1 hold token 555 (a stack of 2), slot 2 holds 777
        "2": { "0": "555", "1": "555", "2": "777" },
      }),
      asset: { getAsset: mock(({ assetId }: { assetId: string }) =>
        Promise.resolve({ asset: assetId, name: assetId === "555" ? "Health Potion" : "Iron Sword", decimals: 0 })) },
    };
    // gamemaster registry catalog: item 555 = consumable(2), item 777 = equipment(1)
    ledger.contract.getSingleContractMapValue = mock(({ key1, key2 }: any) => {
      const items: Record<string, Record<string, string>> = {
        "555": { "1": "2", "4": "0" }, "777": { "1": "1", "4": "0" },
      };
      return Promise.resolve({ value: items[key1]?.[key2] ?? "0" });
    });
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    const inv = await c.getInventory();
    const potion = inv.find(i => i.tokenId === "555")!;
    const sword = inv.find(i => i.tokenId === "777")!;
    expect(potion).toMatchObject({ name: "Health Potion", quantity: 2, itemType: 2 });
    expect(sword).toMatchObject({ name: "Iron Sword", quantity: 1, itemType: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — `getInventory` not defined.

- [ ] **Step 3: Implement**

In `character.ts`, add the import and a lazily-created registry read service + the method:
```ts
import { GamemasterRegistryReadService } from "@signarank/services/gamemaster-registry";
import type { InventoryItem } from "./character.types";
```
Add a private accessor and method to the class:
```ts
    private _registry?: GamemasterRegistryReadService;
    protected get registry(): GamemasterRegistryReadService {
        if (!this._registry) {
            this._registry = new GamemasterRegistryReadService({
                ledger: this.ledger, contractId: this.gamemasterRegistryId,
            });
        }
        return this._registry;
    }

    async getInventory(): Promise<InventoryItem[]> {
        return withError(async () => {
            const slots = await this._mapByK1(CharacterMaps.Inventory);
            const counts = new Map<string, number>();
            for (const tokenId of slots.values()) {
                if (tokenId && tokenId !== "0") counts.set(tokenId, (counts.get(tokenId) ?? 0) + 1);
            }
            const tokenIds = [...counts.keys()];
            const [assets, defs] = await Promise.all([
                Promise.all(tokenIds.map(id => this.getTokenName(id))),
                Promise.all(tokenIds.map(id => this.registry.getItem(id))),
            ]);
            return tokenIds.map((tokenId, i) => ({
                tokenId,
                name: assets[i],
                quantity: counts.get(tokenId)!,
                itemType: defs[i]?.itemType ?? 0,
                effects: defs[i]?.effects ?? [],
            }));
        });
    }

    private async getTokenName(tokenId: string): Promise<string> {
        const cacheKey = `asset:${tokenId}`;
        const cached = await this.cache.get(cacheKey) as { name: string } | null;
        if (cached) return cached.name;
        const asset = await this.ledger.asset.getAsset({ assetId: tokenId });
        await this.cache.set(cacheKey, { name: asset.name }, 10 * 60 * 1000);
        return asset.name;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character.getInventory (slot grouping + catalog resolution)"
```

---

### Task 9: `Character.getConditions` — active timed status effects

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
describe("Character.getConditions", () => {
  test("returns only unexpired status effects with remaining blocks", async () => {
    const ledger: any = {
      contract: mapReader({
        // target 8 (DamageTaken): expiry 1050 (active); target 2 (Strength): expiry 990 (expired)
        "12": { "8": "1050", "2": "990" },
        "13": { "8": "0", "2": "0" },
        "14": { "8": "50", "2": "0" },
        "15": { "8": "700101", "2": "700200" },
      }),
      block: { getBlockById: mock(() => Promise.resolve({ height: 1000 })) },
    };
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    const conditions = await c.getConditions();
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({
      target: 8, effectId: "700101", rel: 50, expiryBlock: 1050, blocksRemaining: 50,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — `getConditions` not defined.

- [ ] **Step 3: Implement**

In `character.ts` add:
```ts
import type { Condition } from "./character.types";
```
```ts
    async getConditions(): Promise<Condition[]> {
        return withError(async () => {
            const [expiryM, absM, relM, idM, block] = await Promise.all([
                this._mapByK1(CharacterMaps.StatusEffects),
                this._mapByK1(CharacterMaps.StatusAbs),
                this._mapByK1(CharacterMaps.StatusRel),
                this._mapByK1(CharacterMaps.StatusEffectId),
                this.ledger.block.getBlockById({ blockId: "", includeTransactions: false } as any),
            ]);
            const now = Number((block as any).height);
            const out: Condition[] = [];
            for (const [target, expiryStr] of expiryM.entries()) {
                const expiryBlock = Number(expiryStr);
                if (expiryBlock <= now) continue; // expired / never set
                out.push({
                    target: Number(target),
                    effectId: idM.get(target) ?? "0",
                    abs: Number(absM.get(target) ?? "0"),
                    rel: Number(relM.get(target) ?? "0"),
                    expiryBlock,
                    blocksRemaining: expiryBlock - now,
                });
            }
            return out;
        });
    }
```
NOTE: match the exact `getBlockById` signature the codebase uses for "current block" — `ConstructInstanceReadService.getPlayerStatus` calls `ledger.block.getBlockById("", false)`. Use the identical call shape here.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character.getConditions (active status effects)"
```

---

### Task 10: `getErrorLog`, `getInternalState`, and composed `getSheet`

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`
- Fixture: `packages/client/src/character-test-contract.json` (create — see Step 3)

- [ ] **Step 1: Write the failing test (error log + sheet)**

Append to `character.test.ts`:
```ts
describe("Character.getErrorLog + getSheet", () => {
  test("getErrorLog returns decoded ring-buffer entries", async () => {
    const ledger: any = {
      contract: mapReader({
        "20": { "0": "13", "1": "7" },              // codes at slots 0,1
        "21": { "0": "999001", "1": "999002" },     // txids at slots 0,1
        "22": { "0": "2" },                          // meta: 2 total
      }),
    };
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    const errors = await c.getErrorLog();
    expect(errors).toContainEqual({ slot: 0, code: 13, txId: "999001" });
    expect(errors).toContainEqual({ slot: 1, code: 7, txId: "999002" });
  });

  test("getSheet composes all read views", async () => {
    const c = new Character({ ledger: fullLedger(), characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    const sheet = await c.getSheet();
    expect(sheet.characterId).toBe(CHAR_ID);
    expect(sheet.vitals.maxHp).toBeGreaterThan(0);
    expect(sheet.attributes.strength).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(sheet.inventory)).toBe(true);
    expect(Array.isArray(sheet.conditions)).toBe(true);
  });
});

// Minimal ledger with all read maps present + block + asset + registry.
function fullLedger() {
  const ledger: any = {
    contract: mapReader({
      "1": { "1": "5", "2": "4", "3": "3", "4": "2", "5": "1" },
      "3": { "1": "7", "2": "2" },
      "4": { "1": "8", "2": "3", "3": "10", "4": "25", "5": "0", "6": "4", "7": "3", "8": "1" },
      "16": { "1": "80", "2": "170", "3": "0" },
      "2": {}, "12": {}, "13": {}, "14": {}, "15": {},
    }),
    block: { getBlockById: mock(() => Promise.resolve({ height: 1000 })) },
    asset: { getAsset: mock(({ assetId }: any) => Promise.resolve({ asset: assetId, name: "x", decimals: 0 })) },
  };
  ledger.contract.getSingleContractMapValue = mock(() => Promise.resolve({ value: "0" }));
  return ledger;
}
```

- [ ] **Step 2: Implement getErrorLog + getSheet**

In `character.ts` add:
```ts
import type { CharacterError, CharacterSheet, InternalState } from "./character.types";
```
```ts
    async getErrorLog(): Promise<CharacterError[]> {
        return withError(async () => {
            const [codes, txids] = await Promise.all([
                this._mapByK1(CharacterMaps.ErrorCode),
                this._mapByK1(CharacterMaps.ErrorTxid),
            ]);
            const out: CharacterError[] = [];
            for (const [slot, code] of codes.entries()) {
                out.push({ slot: Number(slot), code: Number(code), txId: txids.get(slot) ?? "0" });
            }
            return out.sort((a, b) => a.slot - b.slot);
        });
    }

    async getSheet(): Promise<CharacterSheet> {
        return withError(async () => {
            const [attributes, combat, progression, vitals, inventory, conditions] = await Promise.all([
                this.getAttributes(), this.getCombatProfile(), this.getProgression(),
                this.getVitals(), this.getInventory(), this.getConditions(),
            ]);
            return { characterId: this.characterId, attributes, combat, progression, vitals, inventory, conditions };
        });
    }
```

- [ ] **Step 3: Implement getInternalState (memory-index) — derive the layout first**

`rerollCount`/`committed`/`migrated` are contract-memory variables read by position via `ContractDataView`. The positions depend on the compiled layout (`maxAuxVars 3` + `maxConstVars 10` + declaration order), so they must be derived from the compiler output, not guessed.

Derivation (run once, and whenever the character contract is recompiled):
```bash
cd /Users/oliverhager/Code/signum/signarank/smartcontracts
bun /Users/oliverhager/.claude/skills/signum-smartc/scripts/compile.js character/character.contract.smart.c --verbose | grep '\^declare'
```
Count the `^declare` lines from 0; the index of each user variable is its 0-based position in that list. Record the indices for `rerollCount`, `committed`, `migrated`. Also produce a compiled contract JSON fixture for the test:
```bash
bun /Users/oliverhager/.claude/skills/signum-smartc/scripts/compile.js character/character.contract.smart.c --json
```
Copy the emitted `.compiled.json` machine object into `packages/client/src/character-test-contract.json` (it must contain the `machineData`/`machineCode` fields `ContractDataView` consumes — match the shape of the existing `packages/services/src/construct/test-contract.json`).

Add to `character.ts`:
```ts
import { ContractDataView } from "@signumjs/contracts";

// 0-based data-segment indices of internal memory vars — DERIVED from the
// compiled character layout (see plan Task 10 Step 3). Regenerate on recompile.
const CharacterDataFieldIndex = {
    rerollCount: /* fill from ^declare output */ 0,
    committed:   /* fill from ^declare output */ 0,
    migrated:    /* fill from ^declare output */ 0,
} as const;
```
```ts
    async getInternalState(): Promise<InternalState> {
        return withError(async () => {
            const contract = await this.ledger.contract.getContract(this.characterId);
            const view = new ContractDataView(contract as any);
            return {
                rerollCount: Number(view.getVariableAsDecimal(CharacterDataFieldIndex.rerollCount)),
                committed: view.getVariableAsDecimal(CharacterDataFieldIndex.committed) === "1",
                migrated: view.getVariableAsDecimal(CharacterDataFieldIndex.migrated) === "1",
            };
        });
    }
```
Add the internal-state test using the fixture:
```ts
import testCharacter from "./character-test-contract.json";
test("getInternalState reads memory vars by index", async () => {
  const ledger: any = { contract: { getContract: mock(() => Promise.resolve(testCharacter)) } };
  const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
  const state = await c.getInternalState();
  expect(typeof state.rerollCount).toBe("number");
  expect(typeof state.committed).toBe("boolean");
  expect(typeof state.migrated).toBe("boolean");
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS (all read tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.types.ts packages/client/src/character.test.ts packages/client/src/character-test-contract.json
git commit -m "feat(client): Character error log, internal state (memory-index) and composed sheet"
```

---

### Task 11: Writes — scaffolding + `allocateSkillPoint`

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
import { CharacterMethod, AttributeId } from "@signarank/services/character";

describe("Character writes", () => {
  function writeLedger() {
    return {
      transaction: {
        sendMessage: mock((args: any) => Promise.resolve({ unsignedTransactionBytes: "UNSIGNED:" + JSON.stringify(args.messageJson ?? args.message) })),
        sendAmountToSingleRecipient: mock(() => Promise.resolve({ unsignedTransactionBytes: "UNSIGNED" })),
      },
      contract: { getContract: mock(() => Promise.resolve({ minActivation: "200000000" })) },
    } as any;
  }
  const signer = { getPublicKey: mock(() => Promise.resolve("PUBKEY")), sign: mock(() => Promise.resolve({ transaction: "TX1" })) };

  test("allocateSkillPoint signs & broadcasts an ALLOCATE_SKILLPOINT message", async () => {
    const ledger = writeLedger();
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654", signer });
    const res = await c.allocateSkillPoint(AttributeId.Strength);
    expect(res).toEqual({ transaction: "TX1" });
    expect(signer.sign).toHaveBeenCalled();
    const sentArgs = ledger.transaction.sendMessage.mock.calls[0][0];
    // message carries [ALLOCATE_SKILLPOINT, attribute]
    expect(sentArgs.messageIsText).toBe(false);
  });

  test("write without a signer throws", async () => {
    const c = new Character({ ledger: writeLedger(), characterId: CHAR_ID, gamemasterRegistryId: "122344543654" });
    await expect(c.allocateSkillPoint(AttributeId.Strength)).rejects.toThrow(/signer/i);
  });
});
```
NOTE: match the exact `@signumjs/core` transaction builder used for contract method messages — inspect how the codebase already sends a 4-long method message to a contract (search `messageArr`/`sendMessage`/`createMethodCallMessage` usages, e.g. in the construct admin service) and mirror that builder + its argument names. Adjust the assertion to that builder's shape. The behaviour under test is: signer required, correct method code encoded, `Signer.sign` called.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — write methods not defined.

- [ ] **Step 3: Implement scaffolding + allocateSkillPoint**

In `character.ts`, add imports:
```ts
import type { UnsignedTransaction, TransactionId } from "@signumjs/core";
import { Amount } from "@signumjs/util";
import { CharacterMethod, AttributeId } from "@signarank/services/character";
import { tryCall } from "@signarank/common/tryCall";
```
Add private write helpers + the first write method. Use the SAME method-message builder the construct admin service uses (confirmed in Step 1's NOTE); the snippet below assumes a `buildMethodMessage`-style call — replace with the confirmed builder:
```ts
    private requireWrite(): { signer: Signer; ledger: StandardLedger } {
        if (!this.signer) throw new Error("A signer is required for character write operations");
        return { signer: this.signer, ledger: this.context.ledger as StandardLedger };
    }

    private static readonly INTERACTION_FEE = Amount.fromSigna("0.02");
    private static readonly ACTIVATION = Amount.fromPlanck("200000000"); // character #program activationAmount

    private async signAndBroadcast(build: (publicKey: string) => Promise<UnsignedTransaction>): Promise<TransactionId> {
        return tryCall(() => withError(async () => {
            const { signer } = this.requireWrite();
            const publicKey = await signer.getPublicKey();
            if (!publicKey) throw new Error("Signer account has no public key");
            const unsigned = await build(publicKey);
            return signer.sign(unsigned.unsignedTransactionBytes);
        }));
    }

    // Sends [method, a1, a2, a3] to the character with `amountPlanck` attached.
    private async sendMethod(method: number, args: (number | string)[], amountPlanck: string, publicKey: string): Promise<UnsignedTransaction> {
        const { ledger } = this.requireWrite();
        const message = [method, ...args.map(a => Number(a)), 0, 0, 0].slice(0, 4);
        return ledger.transaction.sendMessage({
            recipientId: this.characterId,
            senderPublicKey: publicKey,
            amountPlanck,
            feePlanck: Character.INTERACTION_FEE.getPlanck(),
            message: JSON.stringify(message),   // ← replace with the confirmed 4-long method-message builder
            messageIsText: false,
        } as any);
    }

    async allocateSkillPoint(attribute: AttributeId): Promise<TransactionId> {
        return this.signAndBroadcast(pk =>
            this.sendMethod(CharacterMethod.AllocateSkillpoint, [attribute], Character.ACTIVATION.getPlanck(), pk));
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character write scaffolding + allocateSkillPoint"
```

---

### Task 12: Write — `attack` (amount computation + element token)

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
describe("Character.attack", () => {
  function attackLedger() {
    return {
      transaction: { sendMessage: mock(() => Promise.resolve({ unsignedTransactionBytes: "U" })) },
      asset: { transferAsset: mock(() => Promise.resolve({ unsignedTransactionBytes: "U-ASSET" })) },
      contract: { getContract: mock((id: string) => Promise.resolve({ minActivation: "200000000" })) },
    } as any;
  }
  const signer = { getPublicKey: mock(() => Promise.resolve("PUBKEY")), sign: mock(() => Promise.resolve({ transaction: "TXA" })) };

  test("attack forwards force to the character with the ATTACK method + constructId", async () => {
    const ledger = attackLedger();
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654", signer });
    await c.attack({ constructId: "888", force: Amount.fromSigna("5") });
    expect(ledger.transaction.sendMessage).toHaveBeenCalled();
    expect(signer.sign).toHaveBeenCalled();
  });

  test("attack throws when force is below the required activation minimum", async () => {
    const ledger = attackLedger();
    ledger.contract.getContract = mock(() => Promise.resolve({ minActivation: "200000000" }));
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654", signer });
    await expect(c.attack({ constructId: "888", force: Amount.fromPlanck("1") })).rejects.toThrow(/force|activation/i);
  });

  test("attack with an element token uses the asset transfer builder", async () => {
    const ledger = attackLedger();
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "122344543654", signer });
    await c.attack({ constructId: "888", force: Amount.fromSigna("5"), elementToken: { assetId: "600", quantity: ChainValue.create(0).setCompound("1") } });
    expect(ledger.asset.transferAsset).toHaveBeenCalled();
  });
});
```
Add `import { ChainValue } from "@signumjs/util";` to the test imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — `attack` not defined.

- [ ] **Step 3: Implement**

In `character.ts` add:
```ts
import { ChainValue } from "@signumjs/util";
```
```ts
    async attack(params: { constructId: string; force: Amount; elementToken?: { assetId: string; quantity: ChainValue } }): Promise<TransactionId> {
        const { constructId, force, elementToken } = params;
        return this.signAndBroadcast(async pk => {
            const { ledger } = this.requireWrite();
            // The character forwards the incoming amount to the construct and requires
            // amount >= construct activation; the character AT also needs its own
            // activation to run. Attach at least the max of both minimums.
            const [charC, constructC] = await Promise.all([
                ledger.contract.getContract(this.characterId),
                ledger.contract.getContract(constructId),
            ]);
            const minRequired = BigInt(charC.minActivation) > BigInt(constructC.minActivation)
                ? BigInt(charC.minActivation) : BigInt(constructC.minActivation);
            if (force.getPlanck() === undefined || BigInt(force.getPlanck()) < minRequired) {
                throw new Error(`force too low: must be >= ${minRequired} planck to cover activation`);
            }
            const message = JSON.stringify([CharacterMethod.Attack, Number(constructId), 0, 0]); // ← confirmed builder
            const amountPlanck = force.getPlanck();
            const feePlanck = Character.INTERACTION_FEE.getPlanck();
            if (elementToken) {
                return ledger.asset.transferAsset({
                    assetId: elementToken.assetId,
                    quantity: elementToken.quantity.getAtomic(),
                    recipientId: this.characterId,
                    senderPublicKey: pk,
                    amountPlanck, feePlanck,
                    message, messageIsText: false,
                } as any);
            }
            return ledger.transaction.sendMessage({
                recipientId: this.characterId, senderPublicKey: pk,
                amountPlanck, feePlanck, message, messageIsText: false,
            } as any);
        });
    }
```
NOTE (verify during implementation, per spec §2.5): confirm against the character contract + `signum-smartc-testbed` that forwarding the full incoming amount leaves the character enough gas headroom; if the contract expects `force` to exclude the character's own activation, adjust `amountPlanck`/`minRequired` accordingly and add a testbed-backed assertion.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character.attack (amount validation + element token)"
```

---

### Task 13: Writes — `reroll`, `useItem`, `transferItem`

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
describe("Character reroll/useItem/transferItem", () => {
  function ledgerWithBalance(balancePlanck: string) {
    return {
      transaction: { sendMessage: mock(() => Promise.resolve({ unsignedTransactionBytes: "U" })) },
      contract: { getContract: mock(() => Promise.resolve({ minActivation: "200000000" })) },
      account: { getAccount: mock(() => Promise.resolve({ balanceNQT: balancePlanck, assetBalances: [] })) },
    } as any;
  }
  const signer = { getPublicKey: mock(() => Promise.resolve("PK")), sign: mock(() => Promise.resolve({ transaction: "T" })) };

  test("reroll attaches REROLL_COSTS when the character is unfunded", async () => {
    const ledger = ledgerWithBalance("0");
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "g", signer });
    await c.reroll();
    const args = ledger.transaction.sendMessage.mock.calls[0][0];
    expect(BigInt(args.amountPlanck)).toBeGreaterThanOrEqual(10000000000n); // >= 100 SIGNA
  });

  test("useItem and transferItem sign & broadcast", async () => {
    const ledger = ledgerWithBalance("0");
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "g", signer });
    await c.useItem("555");
    await c.transferItem("777", "10");
    expect(signer.sign).toHaveBeenCalledTimes(2);
  });

  test("transferItem to a contract recipient throws", async () => {
    const ledger = ledgerWithBalance("0");
    ledger.contract.getContract = mock(() => Promise.resolve({ at: "999" })); // recipient is a contract
    const c = new Character({ ledger, characterId: CHAR_ID, gamemasterRegistryId: "g", signer });
    await expect(c.transferItem("777", "999")).rejects.toThrow(/contract/i);
  });
});
```
NOTE: the "transfer to a contract" guard mirrors the contract's own `ERR_TRANSFER_TO_CONTRACT` (recipient has a non-zero codehash / is a contract). Use whatever ledger call the codebase uses to detect a contract account (e.g. `ledger.contract.getContract` throwing for EOAs, or an account `machineCodeHashId`); match an existing detection pattern and adjust the assertion.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — methods not defined.

- [ ] **Step 3: Implement**

In `character.ts` add:
```ts
import { RerollCostsPlanck } from "@signarank/services/character";
```
```ts
    async reroll(): Promise<TransactionId> {
        return this.signAndBroadcast(async pk => {
            const { ledger } = this.requireWrite();
            const account = await ledger.account.getAccount({ accountId: this.characterId });
            const balance = BigInt(account.balanceNQT ?? "0");
            const costs = BigInt(RerollCostsPlanck);
            const activation = BigInt(Character.ACTIVATION.getPlanck());
            // Attach enough so the character holds >= REROLL_COSTS when it runs.
            const needed = balance >= costs ? activation : (costs + activation - balance);
            return this.sendMethod(CharacterMethod.Reroll, [], needed.toString(), pk);
        });
    }

    async useItem(tokenId: string): Promise<TransactionId> {
        return this.signAndBroadcast(pk =>
            this.sendMethod(CharacterMethod.UseItem, [Number(tokenId)], Character.ACTIVATION.getPlanck(), pk));
    }

    async transferItem(tokenId: string, recipientId: string): Promise<TransactionId> {
        return this.signAndBroadcast(async pk => {
            if (await this.isContract(recipientId)) {
                throw new Error("Cannot transfer an item to a contract recipient");
            }
            return this.sendMethod(CharacterMethod.TransferItem, [Number(tokenId), Number(recipientId)], Character.ACTIVATION.getPlanck(), pk);
        });
    }

    private async isContract(accountId: string): Promise<boolean> {
        try { await this.ledger.contract.getContract(accountId); return true; }
        catch { return false; }
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character reroll/useItem/transferItem"
```

---

### Task 14: Writes — `seppuku`, `migrate`, `refund`

**Files:**
- Modify: `packages/client/src/character.ts`
- Test: `packages/client/src/character.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `character.test.ts`:
```ts
describe("Character seppuku/migrate/refund", () => {
  const signer = { getPublicKey: mock(() => Promise.resolve("PK")), sign: mock(() => Promise.resolve({ transaction: "T" })) };
  function ledger() {
    return { transaction: { sendMessage: mock(() => Promise.resolve({ unsignedTransactionBytes: "U" })) } } as any;
  }
  test("each signs & broadcasts its method code", async () => {
    const c = new Character({ ledger: ledger(), characterId: CHAR_ID, gamemasterRegistryId: "g", signer });
    await c.seppuku(); await c.migrate(); await c.refund();
    expect(signer.sign).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/character.test.ts`
Expected: FAIL — methods not defined.

- [ ] **Step 3: Implement**

In `character.ts` add:
```ts
    async seppuku(): Promise<TransactionId> {
        return this.signAndBroadcast(pk => this.sendMethod(CharacterMethod.Seppuku, [], Character.ACTIVATION.getPlanck(), pk));
    }

    async migrate(): Promise<TransactionId> {
        return this.signAndBroadcast(pk => this.sendMethod(CharacterMethod.Migrate, [], Character.ACTIVATION.getPlanck(), pk));
    }

    async refund(): Promise<TransactionId> {
        return this.signAndBroadcast(pk => this.sendMethod(CharacterMethod.Refund, [], Character.ACTIVATION.getPlanck(), pk));
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test packages/client/src/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/character.ts packages/client/src/character.test.ts
git commit -m "feat(client): Character seppuku/migrate/refund"
```

---

### Task 15: Discovery — `Player.getCharacters()` / `character(id)`

**Files:**
- Modify: `packages/client/src/readOnlyPlayer.ts`
- Modify: `packages/client/src/player.ts`
- Test: `packages/client/src/readOnlyPlayer.character.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `readOnlyPlayer.character.test.ts`:
```ts
import { test, expect, describe, mock } from "bun:test";
import { ReadOnlyPlayer } from "./readOnlyPlayer";
import { Character } from "./character";

const OWNER = "42";
const CHAR_REGISTRY = "122344543655";

function ledger() {
  return {
    contract: {
      // gamemaster registry: G_CHAR_REGISTRY read
      getSingleContractMapValue: mock(() => Promise.resolve({ value: CHAR_REGISTRY })),
      // char registry index for owner 42: counter slot (0) + two characters
      getContractMapValuesByFirstKey: mock(({ key1 }: { key1: string }) => {
        if (key1 === OWNER) {
          return Promise.resolve({ keyValues: [
            { key2: "0", value: "2" },         // reserved counter — must be filtered
            { key2: "1001", value: "hashA" },  // characterId 1001
            { key2: "1002", value: "hashB" },  // characterId 1002
            { key2: "1003", value: "0" },      // unregistered — must be filtered
          ]});
        }
        return Promise.resolve({ keyValues: [] });
      }),
    },
    account: { getAccount: mock(() => Promise.resolve({ assetBalances: [], balanceNQT: "0" })) },
  } as any;
}

describe("ReadOnlyPlayer character discovery", () => {
  test("getCharacters returns live characters, filtering counter + unregistered", async () => {
    const p = new ReadOnlyPlayer({ ledger: ledger(), accountId: OWNER, gamemasterRegistryId: "122344543654" });
    const chars = await p.getCharacters();
    expect(chars).toEqual([
      { characterId: "1001", version: "hashA" },
      { characterId: "1002", version: "hashB" },
    ]);
  });

  test("character(id) returns a read-only Character", () => {
    const p = new ReadOnlyPlayer({ ledger: ledger(), accountId: OWNER, gamemasterRegistryId: "122344543654" });
    const c = p.character("1001");
    expect(c).toBeInstanceOf(Character);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test packages/client/src/readOnlyPlayer.character.test.ts`
Expected: FAIL — `getCharacters`/`character` + `gamemasterRegistryId` context field not defined.

- [ ] **Step 3: Implement in ReadOnlyPlayer**

In `readOnlyPlayer.ts`:
- Add to `ReadOnlyPlayerContext`: `gamemasterRegistryId?: string;`
- Store it: `private readonly gamemasterRegistryId: string;` set from `context.gamemasterRegistryId ?? ''` in the constructor.
- Add imports:
```ts
import { GamemasterRegistryReadService } from "@signarank/services/gamemaster-registry";
import { CharRegistryCounterKey2 } from "@signarank/services/character";
import { Character } from "./character";
```
- Add methods:
```ts
    /** Live (non-migrated) characters owned by this account, via the char-account registry. */
    async getCharacters(): Promise<{ characterId: string; version: string }[]> {
        return withError(async () => {
            const registry = new GamemasterRegistryReadService({ ledger: this.ledger, contractId: this.gamemasterRegistryId });
            const charRegistry = await registry.getCharRegistry();
            const { keyValues } = await this.ledger.contract.getContractMapValuesByFirstKey({
                contractId: charRegistry, key1: this.accountId,
            });
            return (keyValues ?? [])
                .filter(kv => kv.key2 !== CharRegistryCounterKey2 && kv.value !== "0")
                .map(kv => ({ characterId: kv.key2, version: kv.value }));
        });
    }

    /** Read-only Character controller (no signer). */
    character(characterId: string): Character {
        return new Character({ ledger: this.ledger, characterId, gamemasterRegistryId: this.gamemasterRegistryId, cache: this.cache as any });
    }
```

- [ ] **Step 4: Implement the write-enabled override in Player**

In `player.ts`, add a `gamemasterRegistryId` passthrough in `PlayerContext` (optional) + override `character`:
```ts
import { Character } from "./character";
```
```ts
    /** Write-enabled Character controller (signer bound). */
    character(characterId: string): Character {
        return new Character({
            ledger: this.context.Ledger,
            characterId,
            gamemasterRegistryId: this.context.gamemasterRegistryId ?? '',
            signer: this.context.Signer,
        });
    }
```
Add `gamemasterRegistryId?: string;` to `PlayerContext`, and pass it into the `super({...})` call as `gamemasterRegistryId: context.gamemasterRegistryId`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test packages/client/src/readOnlyPlayer.character.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/readOnlyPlayer.ts packages/client/src/player.ts packages/client/src/readOnlyPlayer.character.test.ts
git commit -m "feat(client): character discovery via Player (getCharacters/character)"
```

---

### Task 16: Exports, build, typecheck, changeset, version bump

**Files:**
- Modify: `packages/client/src/index.ts`
- Modify: `packages/services/src/index.ts` (if a barrel exists; else the per-dir index)
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Export the new public surface**

In `packages/client/src/index.ts`, add:
```ts
export * from "./character";
export * from "./character.types";
```
Ensure `@signarank/services` re-exports the new `character` subpath the same way it exports `construct` (check the services package `exports` map / index barrels; add `export * from "./character"` where `construct` is exported).

- [ ] **Step 2: Typecheck + build + full test run**

Run: `bun run check-types`
Expected: PASS (no type errors across packages).

Run: `bun test packages/services packages/client`
Expected: PASS — all service + client tests green.

Run: `bun run build`
Expected: PASS — `@signarank/client` and `@signarank/services` build.

- [ ] **Step 3: Add a changeset**

Run: `bun changeset` and select **minor** for `@signarank/client` and `@signarank/services`; summary: "Add Character concept: read sheet + owner-write actions + registry global reads." (Or create `.changeset/character-concept.md` manually):
```md
---
"@signarank/client": minor
"@signarank/services": minor
---

Add the Character concept: a single `Character` class (read sheet + owner-write
actions via an injected Signer), character discovery on `Player`
(`getCharacters`/`character`), and gamemaster-registry global reads
(xp token, constructor account, char registry, next-character-hash / migration window).
```

- [ ] **Step 4: Version bump + commit**

Run: `bun changeset version` (bumps `@signarank/client` and `@signarank/services` to `0.1.0`, updates changelogs).

```bash
git add -A
git commit -m "chore(release): version @signarank/client + @signarank/services to 0.1.0"
```

- [ ] **Step 5: Closing step (manual, outside this plan)**

After publishing `@signarank/client@0.1.0`, bump the signarank Next app dependency:
`"@signarank/client": "^0.1.0"` (repo `signarank`, `package.json`). The character-page UI that consumes this is out of scope.

---

## Self-review

**Spec coverage:**
- VITALS map → Task 1. COMBAT sta/dex/will → Task 2. STATUS_EFFECT_ID → Task 3. Size gate + codehash → Task 4.
- Registry global reads + `isMigrationWindowOpen` → Task 5. Character constants/context → Task 6.
- `Character` reads (scalar/inventory/conditions/errorlog/internal/sheet) → Tasks 7–10. Writes (all 8 actions) → Tasks 11–14. Discovery via Player → Task 15. Caching (catalog TTL, uncached sheet) → Tasks 8/10 (asset cache w/ 10-min TTL; sheet reads uncached). Release/versioning → Task 16.
- Internal-state fields kept memory-index (D2) → Task 10 Step 3. Level-threshold + construct-reader left as documented follow-ups (spec) — intentionally no task.

**Placeholder scan:** The write-message builder and the "contract detection" call are marked as "confirm against the existing codebase builder" NOTES rather than invented APIs — this is deliberate: `@signumjs/core`'s exact method-message builder + contract-detection call must match existing usage (construct admin service), and inventing a signature would be worse than pointing at the source of truth. The behaviour under test in each case is concrete (signer required, correct method code, `Signer.sign` called). `CharacterDataFieldIndex` values are derived from compiler output in Task 10 Step 3 (a real procedure, not a TODO).

**Type consistency:** `Character` context (`{ ledger, characterId, gamemasterRegistryId, signer?, cache? }`), the typed records in `character.types.ts`, `CharacterMaps`/`CombatKeys`/`VitalsKeys` string keys, and `CharacterMethod`/`AttributeId` enums are used consistently across tasks 6–16. `getCharacters()` shape `{characterId, version}` matches the discovery test and spec §2.4.

## Open implementation confirmations (resolve while coding, not blockers)
1. The exact `@signumjs/core` builder for a 4-long contract-method message (mirror the construct admin service) — affects Tasks 11–14 message encoding.
2. Whether `force` should include or exclude the character's own activation when forwarded to the construct — verify against the character contract + `signum-smartc-testbed` (Task 12 NOTE), adjust `amountPlanck`.
3. Contract-recipient detection call for `transferItem` (Task 13 NOTE).
4. `@signarank/services` subpath export config for the new `character` module (Task 7/16).
