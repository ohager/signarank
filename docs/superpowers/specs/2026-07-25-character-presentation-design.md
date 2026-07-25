# Character Presentation & Creation — Design Spec

**Date:** 2026-07-25
**Status:** Draft (approved in brainstorming; pending implementation-plan)
**Scope (two repos, one spec):**
- **Part 1 — this repo (`signarank`):** new `/character` routes, dashboard UI, creation wizard, avatar-upload API route.
- **Part 2 — `signarank-constructor` monorepo (`@signarank/client` / `@signarank/services`):** one remaining new SDK method this design depends on (`Character.getActivity()`) — discovery and creation are already implemented (see Current State).
**Related:** `2026-07-19-client-character-design.md`, `2026-05-06-gamemaster-registry-design.md`, `2026-07-12-registry-as-config-design.md`.

**Update (2026-07-25, post-brainstorm):** the original draft of this spec flagged character discovery and creation as unbuilt SDK prerequisites. Between drafting and approval, `signarank-constructor` gained both (commits `13961d6`, `15fb4c1`, `ab7c6ea`, all 2026-07-25) — see Current State below for the real, current API surface. Only `getActivity()` remains to be built.

---

## Goal

Give a connected wallet a way to discover, select, view, and act on its on-chain Character(s), and a way to create one when it has none (up to the 5-per-account registry cap). This is a pure presentation-layer design — the Character contract and its read/write SDK surface already exist (see `2026-07-19-client-character-design.md`); this spec covers how the signarank web app surfaces them, plus a small set of new SDK/contract capabilities this UI needs that don't exist yet.

## Non-goals (out of scope)

- Reroll-in-wizard UX (reroll stays a dashboard-only action; costs 100 SIGNA + activation, capped at 5 uses).
- Bring-your-own-Pinata-key and paste-a-CID avatar sources (v1 ships server-proxied upload to the operator's Pinata account only).
- Attack UX (lives on the existing construct page, this design only links out to it).

---

## Current state (what exists)

- `character.contract.smart.c` — registry-as-config AT, reads its identities (`constructorAccount`, `xpTokenId`, `charRegistry`) from the gamemaster registry at `init()`. Publishes Attributes, Combat (effective stats), Progression (level/skillPoints), Vitals, Inventory, Conditions (status effects), and a 50-slot rolling error log — all cross-contract readable via KKV maps.
- `character-account-registry.contract.smart.c` — singleton registry storing `(creatorAccount, characterId) → codehash`, plus a per-creator counter at `(creator, 0)`, capped at `MAX_CHARACTERS_PER_ACCOUNT = 5`.
- **`signarank-constructor`'s current Character SDK surface** (as of 2026-07-25, commits through `15fb4c1`) — restructured since the original draft of this spec:
  - `@signarank/services/character` now owns the implementation: `CharacterInstanceReadService` (reads: `getSheet`, `getAttributes`, `getCombatProfile`, `getProgression` — now including `xpPoints`/`xpToNextLevel`, computed via the exported `xpRequiredForLevel`/`xpToNextLevel` triangular-curve helpers in `character.constants.ts` — `getVitals`, `getInventory`, `getConditions`, `getErrorLog` — now resolving human-readable messages via `CharacterErrorMessages`, `getInternalState`) and `CharacterInstanceService extends CharacterInstanceReadService` (writes: `allocateSkillPoint`, `attack`, `reroll`, `useItem`, `transferItem`, `seppuku`, `migrate`, `refund`).
  - **`CharacterService`** (`@signarank/services/character/character.service.ts`) — registry-level: `.with(characterId)` returns a bound `CharacterInstanceService`; **`getCharacters(accountId): Promise<RegisteredCharacter[]>`** (`{characterId, codeHash}[]`) resolves the char registry via the gamemaster registry and queries it — this is the discovery method Part 3 needs, already built; **`createCharacterInstance({name, description?}): Promise<TransactionId>`** — the two-chained-tx deploy (`publishContractByReference` → sign → `referencedTransactionFullHash`-linked funding tx for `CharacterCreationCostsPlanck` = `"1000000000"` planck = 10 SIGNA) — this is the creation method Part 4 needs, already built. Requires `context.characterContractReference` (the Character contract's "green"/already-deployed reference tx hash) — **not yet resolved for this app**, see Part 2.
  - `@signarank/services/character-registry` (`CharacterRegistryService`) — the underlying registry read wrapped by `CharacterService.getCharacters`.
  - `@signarank/client`'s `Character` class is now a thin adapter: `class Character extends CharacterInstanceService`, translating the client's context shape into the service's constructor shape.
  - **Still missing:** `getActivity()` — confirmed via search, no `getActivity`/`ActivityFeed`/`CharacterEvent` anywhere in the monorepo. This is Part 6 of this spec.
- This repo has no character-related routes, nav item, or components yet. Precedent to follow: `pages/construct/[contractId].tsx` (SSR preview + client body split), `useConstruct.ts` (react-query + `ReadOnlyPlayer`), `WalletHandler.ts` (extension-wallet connect via redux), `AttackHistory.tsx` + `lib/narration/` (existing tx-decoding + flavor-text pattern for constructs, app-side).
- `packages/services/src/media/media.upload.service.ts` (in `signarank-constructor`) — existing Pinata+R2 upload logic, but **Bun-specific** (`Bun`'s `S3Client`, local filesystem paths) and not installed in this repo. Decision: mirror/port this logic into this repo's own API route using Node-standard equivalents, not share it as a package — `@signarank/client` is a pure browser-side library and shouldn't gain server secrets or a Node/Bun runtime dependency for one caller.
- `R2_CDN_BASE = 'https://r2.signarank.club'` (`lib/construct/constants.ts`) — the existing public CDN base; character avatars mirror into the same bucket, new object keys.

---

## Part 1 — Contract fix (already applied this session)

`character.contract.smart.c`'s `SEPPUKU` dispatch case was gated on `isDead == TRUE && committed == TRUE` — a regression from an editing session on 2026-07-11 that silently flipped Seppuku's semantics from "end your life while alive" to "retire an already-dead corpse," while the `seppuku()` function body and its comments still described the original "ritual suicide" behavior. Reverted to the correct gate: `isDead == FALSE && committed == TRUE`. This restores `seppuku()`'s original effect (kills the character, triggers the normal `handleDead()` attribute-penalty path via `main()`'s post-loop check, unregisters from the character-account registry, sends back no SIGNA/assets — `refund()` remains the separate way to reclaim balance).

`registration/registration.test.ts`'s `seppuku()` suite was rewritten to match (kill-while-alive as the happy path, a new "no-op if already dead" case, adjusted non-creator/repeat-call cases). Verified via `git stash` comparison against baseline: 9 failed/1 passed → 6 failed/4 passed. The remaining 6 failures are a **pre-existing, unrelated** `signum-smartc-testbed` drift issue (combat RNG helpers and cross-contract registry reads failing identically with or without this fix) — same class of problem already noted against the construct suite on 2026-07-10. Out of scope for this design; flagged as a separate follow-up.

---

## Part 2 — Architecture Overview

**Routes (this repo):**
- `/character` — discovery/selection.
- `/character/[characterId]` — dashboard.
- `/character/create` — creation wizard.
- New "Character" link in `Header.tsx`'s nav (desktop + mobile), gated on wallet connection like `ConnectButton`.

**New SDK surface still required (prerequisite work in `signarank-constructor`):**
- `Character.getActivity({limit}): Promise<CharacterEvent[]>` — the only remaining gap, see Part 6.

**Config-only prerequisite (this repo, not SDK code):** `CharacterService`'s `createCharacterInstance` requires `context.characterContractReference` — the reference transaction hash of the Character contract's currently-deployed "green" bytecode (mirrors how `ConstructAdminService` needs a `greenContractReference` supplied by its caller). This needs to be resolved and added as a per-network constant/env var in this repo before Part 4 can call it — not a code gap, just a value that needs sourcing (likely the deploy tx hash of the currently-live reference Character contract on the target network).

**New in this repo:**
- `pages/api/character/upload-avatar.ts` — server-side proxy. Accepts an image, validates it, pins to the operator's Pinata account, mirrors to R2 (porting `MediaUploadService`'s logic to Node-standard APIs — `pinata` SDK works fine outside Bun; R2 write needs `@aws-sdk/client-s3` in place of Bun's `S3Client`), returns `{ipfsCid, mimeType, url}`. New server-only env vars: `PINATA_JWT`, `PINATA_GATEWAY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

---

## Part 3 — Discovery & Selection (`/character`)

- On wallet connect, query the registry (`CharacterService.getCharacters(accountId)`) for confirmed characters, and read `localStorage` for in-flight creations (see Part 4) — merge into one list, keyed by wallet account (a browser may see multiple wallets connect over time).
- **Layout: card grid.** Every character (confirmed + pending) as an equal card in a responsive grid; click a confirmed card to enter its dashboard. Pending cards render dashed/muted with their current creation step, not clickable.
- Zero total (confirmed + pending) → empty state, prominent "Create Character" CTA.
- At the 5-character cap (confirmed + pending, since a pending one will consume a slot once it registers) → CTA becomes disabled with an explanatory tooltip rather than hidden.
- Exactly one confirmed character and nothing pending → auto-redirect straight to its dashboard, skipping the selection screen.

---

## Part 4 — Creation Wizard (`/character/create`)

### Steps

1. **Name & Description** — matches SRC44 conventions already used for constructs (name length-capped similarly to the gamemaster CLI's 24-char limit; description free text).
2. **Avatar** — image picker. Client-side validates dimensions (≤1024×1024) and size (≤2MiB) before any network call; if the image exceeds either bound, auto-resize/compress via canvas (with a crop-to-square helper, since avatars render circular) rather than hard-rejecting. The conforming image uploads immediately via `upload-avatar.ts` as soon as the crop is confirmed — before advancing to review — so upload problems fail fast, before any wallet interaction or money is at stake.
3. **Review & Confirm** — shows the already-composed identity (name/description/avatar — no chain read needed, we built it), a cost breakdown (tx1 network fee + tx2 network fee + 10 SIGNA recharge, summed), and a wallet-balance check that warns on insufficient funds. "Create Character" button.
4. **Creating…** — calls `CharacterService.createCharacterInstance({name, description})`, which internally signs two sequential transactions (deploy, then the chained funding tx) — the wizard shows explicit step labels ("Step 1 of 2: Approve character deployment in your wallet" → "Step 2 of 2: Approve funding transaction") since the extension wallet needs a separate approval per transaction. Once both are broadcast, the 4-state progress tracker takes over (below), with an elapsed-time counter against a "~4–8 min typical" estimate (2 blocks × ~240s/block).
5. **Live** — success state showing the full character sheet, "View Character" → dashboard.

### Progress tracking — 4-state model

Reflects the real Signum AT execution model: a contract funded in block N doesn't run `init()` until block N+1 (the AT engine processes each block's transaction queue using confirmations accumulated as of the *prior* block).

| State | Condition | What's knowable |
|---|---|---|
| 1. Pending | tx1 & tx2 both unconfirmed (mempool) | Nothing on-chain yet — but identity (name/description/avatar) is already shown, since it was composed client-side before broadcast, not read from chain |
| 2. Deployed | tx1 confirmed (0 conf), tx2 still pending | Contract account exists; SRC44 attachment readable |
| 3. Funding settled | tx2 confirmed (0 conf), tx1 now 1 conf | Balance funded; `init()` hasn't run yet — no stats |
| 4. Live | tx2 reaches 1 conf (one more block passed) | `init()` ran — attributes rolled, vitals/progression published, character fully playable, registry entry exists |

Worst-realistic-case timeline: ~2 blocks (~8 min), assuming tx1+tx2 land in the same block (likely, since chaining only requires tx2 not to precede tx1 — no artificial delay is needed between broadcasting the two).

### `localStorage` schema

Key: `signarank:pendingCharacters:${accountId}`, array of:
```
{ contractId, tx1Id, tx1FullHash, tx2Id?, name, description,
  avatarCid, avatarMime, avatarUrl, submittedAt,
  state: 'pending'|'deployed'|'funding_settled'|'live'|'needs_funding'|'failed', error? }
```
`contractId` is known synchronously right after tx1 is signed (it *is* tx1's id) — the natural key. An entry is written the moment tx1 is signed, before broadcast even confirms. Pruned once `state` reaches `'live'` **and** the registry query independently confirms it — after that the registry is the source of truth, no need to keep tracking it client-side. This bridges a real visibility gap: the registry has zero knowledge of a character until `init()` runs and sends the registration message (state 4), so without this, a creation in progress would be entirely invisible on `/character`.

### Failure handling

- Wallet rejects/cancels signing tx1 → nothing happened on-chain; reset to step 3, no `localStorage` entry written.
- tx1 broadcasts but the player rejects/cancels tx2 (or it fails to broadcast) → the deploy is on-chain but unfunded; `init()` never runs, and — importantly — it never consumes one of the 5 registry slots (registration happens inside `init()`). Entry marked `needs_funding`; the `/character` grid shows a **"Resume Funding"** action that sends a plain ≥10 SIGNA payment to the already-known `contractId` (no re-chaining needed — tx1 is already confirmed, so ordering is no longer a concern).
- Upload failure (step 2) → inline retry, wizard doesn't advance, nothing costs money yet.

---

## Part 5 — Dashboard (`/character/[characterId]`)

### Layout

Left rail (wide, ~260px) + tabbed main area:

- **Left rail:** large circular avatar, name, level badge, HP bar, XP progress bar ("1,240 / 3,000 XP to Lvl 5" — both values fully derivable client-side: `xp = getAssetBalance(xpTokenId)` on the character's account, and the triangular curve `XP to reach level L = 1000 × L×(L−1)/2` needs only the published `level`, no extra contract read), then action buttons.
- **Main area tabs:** Overview (Attributes + Effective Combat side by side, base-vs-equipment-delta shown per stat), Inventory (item grid, per-item Use/Transfer), Conditions (active timed status effects with countdown), Activity (merged event feed, see Part 6).

### Rail action wiring

| Button | SDK call | Visibility / gating | Confirm dialog? |
|---|---|---|---|
| Battle → | *(navigates to the construct page — not a Character call)* | Hidden while dead | No |
| Allocate | `allocateSkillPoint(attrIndex)` | Shown only when `skillPoints > 0`; opens a picker for which of the 5 attributes | No |
| Reroll | `reroll()` | Disabled once `committed === true` (read via `getInternalState()`) or `rerollCount >= 5`, with the rail explaining why rather than just hiding it | Yes — 100 SIGNA + activation |
| Refund | `refund()` | Always available | No — reclaiming the player's own funds |
| Seppuku | `seppuku()` | Enabled only when `committed === true && isDead === false` (post-fix semantics — see Part 1) | Yes, with explicit copy: **"This ends your character's life. It does not return your remaining balance — use Refund first if you want it back."** |
| Migrate | `migrate()` | Visible only when the gamemaster registry's migration-window flag (`G_NEXT_CHARACTER_HASH`) is set — hidden entirely otherwise, not just disabled | Yes — liquidates everything and permanently retires the character |

**Per-item actions (Inventory tab):** Consumables get "Use" (`useItem(tokenId)`); both item types get "Transfer" (`transferItem(tokenId, recipientId)`, reusing the existing `AddressInput` component). Equipment shows as auto-equipped with no standalone action — removing it means transferring it out, which the contract already reverses the aggregate bonus for.

---

## Part 6 — Activity Feed (SDK, `signarank-constructor`)

The Activity tab shows a **merged, narrated feed** (not just the error log) — owner actions, damage taken, XP rewards, and rejected actions, newest first, capped at the most recent 50. This requires reconciling three different on-chain sources, each needing different contract knowledge:

1. **User-initiated actions** (allocate, reroll, useItem, transferItem, seppuku, refund, migrate, attack) — decoded from the character's own incoming transactions, keyed by `message[0]`. Attack is enriched beyond a bare "you attacked X": it also carries the SIGNA forwarded, any attached element token, and a `potentialDamage` figure derived from the target construct's live `baseDamageRatio` (`floor(signaAmount × baseDamageRatio / 1e10)`, the *base* SIGNA-derived damage — not the character's own combat-profile bonuses, which aren't reconstructible after the fact). Comparing this against the corresponding `EffectiveDamageApplied` event gives a player an attempt-vs-outcome read despite the regen gap below.
2. **Damage taken** — also an incoming tx (`RECEIVE_ATTACK` from a trusted construct), but the message only carries *raw* damage; actual HP lost after mitigation is only recoverable by diffing `currentHp` across the Vitals map between activations, or re-running the character's own published mitigation formula off-chain.
3. **Rewards** — not visible in the character's own tx history directly; inferred from XP-token asset transfers arriving *from* a construct (the same indirect pattern `useAttackHistory.ts` already uses on the construct side).

**Decision: this aggregation lives in the SDK, not this app.** `Character.getActivity({limit})` (new method, `@signarank/client`) decodes all three sources and returns one typed, chronologically-merged `CharacterEvent[]`. This app only maps each typed event to icon/copy — the same role `lib/narration/pickNarration.ts` already plays for constructs. This deliberately departs from the construct precedent (where `useAttackHistory.ts` decodes transactions directly in this app) because reconstructing character activity correctly requires message/error-code knowledge and mitigation math the SDK already owns or should own — duplicating it here risks drift, and the character's event vocabulary (damage, items, level-ups, deaths, rejections) is richer and more reusable across surfaces than construct's single-purpose attack log.

**Scoped down during implementation planning** (see the linked plan below for full reasoning): `DamageTaken` events carry *raw* pre-mitigation damage, not net — historical mitigated-HP snapshots aren't reconstructible from the current map-only read API.

**XP-token receipts become `EffectiveDamageApplied` events — and the name is literal, not a euphemism** (deep-dived with Oliver, 2026-07-25, against `construct.contract.smart.c:471-515`): the construct clamps its damage value to its own remaining HP before sending it, so the XP quantity sent is always exactly the real HP reduction that hit caused — 1 XP = 1 damage point. The construct sends XP to the attacking character's own account (what this event tracks) but sends the HP token (the *other* reward currency) to the character's *creator's* EOA directly, bypassing the character's account entirely — so a per-construct cumulative damage figure is a player-profile-level feed, out of scope for a method keyed to one character. A further catch: this figure is accurate *per event* but not summable into "total damage this construct has taken" — constructs regenerate HP over time with no corresponding event ever reaching the character (regen isn't attacker-triggered and never touches XP), so a running total would silently ignore regen and overstate how close a construct is to defeat.

**Legitimacy filtering added during implementation planning** (Oliver's review, 2026-07-25): a transaction or transfer is only narrated if it matches one of three *verified* identity patterns — sender is the character's own creator (owner action), sender's **live codehash** matches the gamemaster registry's current trusted construct hash (construct attack, or an XP-token transfer — not just "the message looks like RECEIVE_ATTACK" or "it's the right token"), or sender is the character itself and recipient is its creator (the contract's own outgoing narrative text, e.g. "Congrats, character leveled up" — a new `CharacterMessage` event type). Anything else is silently dropped rather than guessed at — this closes a real spoofing gap, since `xpTokenId` is a plain tradable asset anyone could otherwise send the character to fabricate a fake damage event.

**Implementation plan:** `signarank-constructor/docs/superpowers/plans/2026-07-25-character-activity-feed.md` — fully speced (`CharacterEventType` enum, `CharacterEvent` discriminated union, message-hex decoder via `@signumjs/util`'s `convertHexEndianess`/`convertHexStringToDecString`, transaction/asset-transfer mappers, `getActivity()` orchestration, export wiring, changeset). Ready to execute.

---

## Follow-up / prerequisite tickets

1. ~~`CharacterAccountRegistryReadService` in `@signarank/services`~~ — **done** (`CharacterRegistryService.getCharacters`, shipped 2026-07-25).
2. ~~Player-signed character-creation service in `@signarank/client`~~ — **done** (`CharacterService.createCharacterInstance`, shipped 2026-07-25).
3. `context.characterContractReference` needs a real value sourced for this app before Part 4's creation call can run (config, not code — see Part 2).
4. `Character.getActivity({limit})` in `@signarank/client` — implementation plan written (Part 6), not yet executed.
5. `signum-smartc-testbed` drift affecting combat-RNG helpers and cross-contract registry reads across the character test suite (17 files affected as of this session) — pre-existing, unrelated to this design, needs its own investigation.
