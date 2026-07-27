# Character Creation — Single-Screen Redesign

**Date:** 2026-07-27
**Status:** Draft (approved in brainstorming; pending implementation plan)
**Scope:** This repo (`signarank`) only. No SDK/contract changes.
**Supersedes (for creation UX only):** Part 4 of `docs/superpowers/specs/2026-07-25-character-presentation-design.md` and its implementation, `docs/superpowers/plans/2026-07-26-character-creation-wizard.md`. Parts 1, 2 (avatar upload API), 3 (discovery), 5 (dashboard), 6 (activity feed) of that spec are untouched and still apply.

---

## Goal

The shipped creation wizard (`components/Character/CreateWizard/`) is a six-step flow (Name → Avatar → Review → Creating → Confirming → Live) that's visually plain and over-segmented for what is actually three form fields (name, description, avatar) followed by an unavoidable on-chain wait. Collapse the three input steps into one screen, drop the standalone Review step (fold its content into the same screen), and move the "waiting for the chain" experience out of the linear wizard entirely — onto a per-character page reachable from a persistent, site-wide header indicator. Give the result a visual pass consistent with the existing Immersive Realm design system.

## Non-goals

- No changes to the Character contract, the character-account registry, or `@signarank/client`/`@signarank/services`.
- No discovery/listing page (`/character`, spec Part 3) — still separate, future work. This design's header badge uses a heuristic (below) instead of a real list UI.
- No character dashboard (`/character/[contractId]`'s *live* state, spec Part 5) — this design only adds the *pending/materializing* rendering to that route. The live-state dashboard is a separate follow-up that will render on the same route once built.
- No changes to the reroll/attack/dashboard action flows.
- Avatar upload mechanics (crop/resize/Pinata/R2 proxy) are unchanged — this is a pure presentation/flow redesign around the existing `upload-avatar` API and `avatarImage.ts` helpers.

---

## Current state (what exists, what changes)

`components/Character/CreateWizard/CharacterCreateWizard.tsx` is a `useState<WizardStep>`-driven switch over six step components, each a separate file. `pages/character/create.tsx` renders it directly. Progress after signing is tracked by `hooks/useCharacterCreationProgress.ts` (manual `setInterval` polling) and persisted via `lib/character/pendingCharacters.ts` (a plain localStorage CRUD module, already covered by tests — schema unchanged by this design). Mobile wallet round-trips resume via query params parsed in the wizard's `useEffect` (`mobileCharacterStatus`/`Step`/`TxId`), landing back on `/character/create`.

This design:
- Deletes `NameDescriptionStep.tsx`, `AvatarStep.tsx` (component only — its `avatarImage.ts`/upload logic is reused), `ReviewStep.tsx`, `CreatingStep.tsx`, `ConfirmingStep.tsx`, `LiveStep.tsx`, and the `CharacterCreateWizard.tsx` orchestrator.
- Adds a single `CharacterCreateForm.tsx` replacing the first three steps.
- Adds `pages/character/[contractId].tsx`, a new route hosting what `ConfirmingStep`/`LiveStep` used to show, keyed by URL param instead of wizard state.
- Converts `useCharacterCreationProgress` from manual polling to a `useQuery`-backed hook (`@tanstack/react-query`, already used throughout `hooks/` — see `useConstruct.ts`, `usePendingAttacks.ts` for the established pattern: `queryKey`, `refetchInterval`, `refetchOnWindowFocus: false`).
- Adds `hooks/usePendingCharacters.ts`, a thin `useQuery` wrapper over `pendingCharacters.ts` that both the header and the new route consume.
- Adds a badge to `components/Header.tsx`.

---

## Architecture: state sharing without a Context provider

Because `Header.tsx` is mounted for the lifetime of the app (it's outside page content, in the layout), and `@tanstack/react-query` shares one cache entry per `queryKey` across every component that calls `useQuery` with that key, Header polling and the `/character/[contractId]` page polling **are the same query** — no dedicated Context/Provider component is needed:

- `hooks/usePendingCharacters.ts`: `useQuery(['pendingCharacters', accountId], () => getPendingCharacters(accountId), { enabled: !!accountId })`. Exposes a `mutate`-style wrapper around `upsertPendingCharacter`/`updatePendingCharacter`/`removePendingCharacter` that calls `queryClient.invalidateQueries(['pendingCharacters', accountId])` after writing, so every mounted consumer re-renders from the same source of truth.
- `hooks/useCharacterCreationProgress.ts` (refactored): `useQuery(['characterProgress', contractId], () => pollOnce(ledger, tx1Id, tx2Id), { refetchInterval: 15_000, enabled: !!tx1Id && !!tx2Id && state !== 'live', refetchOnWindowFocus: false })`.
- To satisfy "persists across navigation" precisely (not just "resumes when you happen to revisit the page"), `Header.tsx` maps over `usePendingCharacters()`'s non-terminal entries and renders one invisible `<CreationTracker key={contractId} tx1Id={tx1Id} tx2Id={tx2Id} />` per entry — a component that returns `null` and exists purely to keep that entry's `useCharacterCreationProgress` query mounted (and its `updatePendingCharacter` side effect running) for as long as the app is open, regardless of which page is visible. Since Header is always mounted, this makes the badge's state genuinely live site-wide.
- When `/character/[contractId]` is also open, it mounts the *same* `queryKey` — react-query shares the one interval and cache entry rather than double-polling, the same dedup guarantee already relied on elsewhere in this codebase (e.g. `useConstruct.ts`).

## `/character/create`

Single `glass-static` panel, `CharacterCreateForm.tsx`:

- **Name** — text input, same 24-char cap and validation as today's `NameDescriptionStep`.
- **Description** — textarea, same as today.
- **Avatar** — dropzone/file input. On file pick: client-side constraint check + crop/resize (`avatarImage.ts`, unchanged) → immediate upload to `/api/character/upload-avatar` (unchanged endpoint) → on success, the dropzone becomes a circular preview with a small "change" affordance; on failure, inline error, user can retry without touching name/description.
- **Cost & balance review** (merged from `ReviewStep`) — renders as soon as `signaBalance` is known (not gated on name/avatar being filled): recharge cost, estimated network fees, total, and an insufficient-funds warning if applicable. This *is* the "review" — always visible, not a separate confirmation screen.
- **Create Character** button — disabled until: name non-empty and ≤24 chars, avatar upload succeeded, balance sufficient. No Back button; this is the only screen.

On click: calls the existing `useCharacterCreation().create()` unchanged. While `creating`, the panel shows inline step copy in place of the button ("Step 1 of 2: Approve character deployment in your wallet" / "Step 2 of 2: Approve funding transaction in your wallet" — reused verbatim from today's `CreatingStep.STEP_LABEL`). Desktop/extension: both signatures resolve before `create()` returns, so on success the page immediately upserts the pending-character entry (via `usePendingCharacters`) and `router.push('/character/${contractId}')`. Mobile: `create()` returns after the deploy signature triggers a redirect away (unchanged SDK/hook behavior) — the redirect-back handling described below takes it from there.

## `/character/[contractId]` (new route)

`pages/character/[contractId].tsx`. Reads the matching entry from `usePendingCharacters()` by `contractId` (the URL param). Renders:

- Circular avatar, name (from the cached entry — no chain read needed for identity, matching the original spec's Part 4 rationale).
- Status copy per state, reusing `ConfirmingStep.STATE_COPY` verbatim (`pending`/`deployed`/`funding_settled`/`needs_funding`/`failed`; `live` becomes a distinct success view, see below).
- Elapsed-time counter against the "~4–8 min typical" framing, reusing `ConfirmingStep`'s `WORST_CASE_MS` threshold and copy.
- When `state === 'needs_funding'`: the "Continue: Fund Character" button, wired to the existing `useCharacterFunding().fund(contractId)` unchanged.
- When `state === 'live'`: success framing ("`{name}` has awoken.") with a forward link. Since the dashboard (spec Part 5) doesn't exist yet, this link can point at a placeholder/disabled affordance for now — out of scope to build the full dashboard here; this route is deliberately structured so the dashboard can take over rendering for the `live` case later without changing the route or the pending-entry lookup.
- If no matching entry exists in `usePendingCharacters()` for this `contractId` at all (e.g. direct link to an unknown id, or a `live` character that's aged out of localStorage) — show a simple "not found" state. Reconciling against the on-chain registry for already-live characters is dashboard/discovery work, out of scope here.

## Header badge

Added to `components/Header.tsx`, next to `ConnectButton` (both desktop and mobile layouts, matching how `ConnectButton` already appears in both). Rendered from `usePendingCharacters(accountId)`, filtered to non-terminal states (`pending`, `deployed`, `funding_settled`, `needs_funding`) plus `failed` (shown, since it needs the user's attention):

- Nothing pending → badge renders nothing.
- Otherwise: a small dot. Gold, gently pulsing (reuse the existing `@keyframes breathe` from `globals.css`) when every pending entry is in an automatic-progress state (`pending`/`deployed`/`funding_settled`). Solid ember, no animation, if any entry is `needs_funding` or `failed` (needs the user).
- Click routing: exactly one pending entry → that entry's `/character/[contractId]`. Multiple → prefer one `needs_funding`/`failed` (most actionable) over one still auto-progressing; ties broken by oldest `submittedAt`. This is a deliberate heuristic, not a list UI — acceptable because the registry caps characters at 5 per account and concurrent in-flight creations are expected to be rare. Superseded by the real discovery page (spec Part 3) whenever that's built.
- Per the "always poll" decision above, Header also renders one invisible `<CreationTracker>` per non-terminal entry to keep progress live even when no `/character/[contractId]` page is open.

## Mobile redirect/resume flow

Today, both the `deploy`-step and `fund`-step mobile redirects land back on `/character/create` and are parsed by the wizard's single `useEffect`. This splits across two routes:

- **`deploy`-step resume** stays on `/character/create` (unchanged entry point — `useCharacterCreation`'s mobile branch already builds the callback URL from `window.location.pathname`, which is `/character/create` at signing time). `CharacterCreateForm.tsx` keeps a trimmed version of today's `useEffect` logic: parse `mobileCharacterStatus`/`mobileCharacterTxId` from the query, recover the draft (`loadDraft`), upsert the pending entry, clear the query params, then `router.push('/character/${contractId}')` — same as the desktop success path, just arrived at differently.
- **`fund`-step resume** moves to `/character/[contractId].tsx`, because that's now where the "Continue: Fund Character" button lives, and `useCharacterFunding`'s callback URL is already built from `window.location.pathname` at the point the button is clicked — which will naturally be `/character/[contractId]` once the button moves there. No change needed to `useCharacterFunding` itself, only to *where* the button (and its matching resume-parsing `useEffect`) lives.
- The already-solved "React state doesn't survive a mobile redirect" problem (today's fallback of re-reading `getPendingCharacters(...).find(c => c.state === 'needs_funding')`) still applies identically on `/character/[contractId]`, since the redirect target now includes the known `contractId` in the URL itself — actually simpler than today, since the contract id no longer needs to be *recovered*, it's already the route param.

## Error handling

- Wallet rejects/cancels signing before any `contractId` exists → stay on `/character/create`, inline error (unchanged from today's cancellation handling in `useCharacterCreation`), no pending entry written. This includes the mobile redirect-back case (`mobileCharacterStatus !== 'success'`): since `/character/create` is now always the same single panel (no step to "go back" to), the resume `useEffect` just sets the same inline error state the desktop path uses and clears the query params — no `setStep('review')`-equivalent needed.
- Failure after `contractId` is known (e.g. funding fails, chain error) → entry marked `failed` via `updatePendingCharacter`; `/character/[contractId]` shows the error state; header badge goes solid ember.
- Avatar upload failure → inline on `/character/create`, form stays interactive, nothing else affected (unchanged from today's `AvatarStep` behavior, just inlined into the single panel).

## Visual treatment

Structural/behavioral design is covered above; the actual visual polish (spacing, iconography, avatar dropzone interaction states, badge animation tuning, panel layout) is implementation-phase work for the **frontend-design** skill, working within the existing Immersive Realm system already established in `styles/globals.css` and used throughout (`glass`/`glass-static` panels, Cinzel/Cormorant Garamond/IBM Plex Mono fonts, gold/ember/frost palette, `section-label` conventions). No new design system is being introduced.

## Testing approach

Follows this codebase's existing precedent (see `docs/superpowers/plans/2026-07-26-character-creation-wizard.md`, Task 1–4): pure logic (`pendingCharacters.ts`, `avatarImage.ts` bounds-checking) is unit-tested with Vitest; DOM-heavy components (`CharacterCreateForm.tsx`, the new `[contractId].tsx` page) have no component-testing setup in this repo and are hand-verified in the browser, matching `AttackForm.tsx`/`ConstructPageBody.tsx` precedent. The refactored `useCharacterCreationProgress` (manual interval → `useQuery`) should get a unit test for its pure state-derivation logic (given tx1/tx2 confirmation counts, which `PendingCharacterState` results), same as today's implicit coverage via the hook's straightforward branching.

## Follow-up / explicitly deferred

1. Real discovery/list page (spec Part 3) — supersedes the header badge's multi-pending heuristic.
2. Full dashboard rendering for `state === 'live'` on `/character/[contractId]` (spec Part 5) — this design only stubs a success state there.
3. `Character.getActivity()` and everything else in spec Part 6 — unrelated to this design.
