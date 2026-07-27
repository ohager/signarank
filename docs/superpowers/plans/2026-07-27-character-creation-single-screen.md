# Character Creation Single-Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six-step character creation wizard with one form + a per-character progress page (`/character/[contractId]`) reachable from a site-wide header indicator, plus a shared character-sheet preview that shows the 5 attribute stats as resolving `?` placeholders until the character goes live.

**Architecture:** `pages/character/create.tsx` renders a single `CharacterCreateForm` (name/description/avatar fields + inline cost review + a live `CharacterSheetPreview`). On success it writes a `pendingCharacters` localStorage entry (via a new `usePendingCharacters` react-query hook) and routes to `pages/character/[contractId].tsx`, which polls on-chain confirmation state (`useCharacterCreationProgress`, refactored onto `useQuery`) and renders the same preview in "materializing" mode (shimmering `?`s + a 4-dot stepper). `components/Header.tsx` renders one invisible `CreationTracker` per in-flight character (keeping the progress query alive site-wide via react-query's queryKey-based cache sharing — no Context/Provider needed) plus a small status dot that links to the relevant character.

**Tech Stack:** Next.js Pages Router, React, `@tanstack/react-query` v5 (already used throughout `hooks/`), `@signarank/client`, `@signumjs/core`/`@signumjs/util`, Vitest (pure-logic unit tests only — this repo has no component-testing setup, so DOM-heavy components are hand-verified in the browser, matching existing precedent).

**Supersedes:** `docs/superpowers/plans/2026-07-26-character-creation-wizard.md`'s Tasks 9-11 output (the wizard step components and orchestrator). Tasks 1-8 of that plan (config constants, `pendingCharacters.ts`, `avatarImage.ts`, media upload service/route, `useCharacterFunding`, `useCharacterCreation`, the mobile callback page) are unchanged and reused as-is.

---

## Design notes (read before starting)

1. **No Context/Provider for site-wide state.** `components/Header.tsx` is rendered inside `components/Page.tsx`, which every page uses — so Header (and anything it renders) is present on every route. Because `@tanstack/react-query` shares one cache entry per `queryKey` across every mounted `useQuery` call with that key, a `useCharacterCreationProgress` call in `Header.tsx` (via `CreationTracker`) and the same call on `/character/[contractId]` are the *same query* — one interval, shared cache, no duplicate network calls, no bespoke provider.
2. **`connectedAccount` (the wallet public key) is the storage key**, not the derived numeric account id. `lib/character/pendingCharacters.ts` has always been keyed this way (see `CharacterCreateWizard.tsx`'s existing `upsertPendingCharacter(connectedAccount, ...)` calls) — every new read/write in this plan uses the same raw `connectedAccount` string for consistency with entries already written by the current shipped wizard. The *numeric* account id (`Address.fromPublicKey(connectedAccount).getNumericId()`) is only ever needed for `useTokenBalances`.
3. **`useCharacterCreation.ts`, `useCharacterFunding.ts`, `pages/wallet/character-signed.tsx`, and `lib/character/pendingCharacters.ts` are unchanged by this plan.** Their APIs are reused exactly as they exist today — only *where* they're called from moves (the funding button moves from a wizard step to `/character/[contractId]`; `character-signed.tsx` already builds its redirect from `window.location.pathname`, so it needs no changes to land on the new pages).
4. **Attribute reveal is all-or-nothing.** The Character contract's `init()` rolls and writes all 5 attributes (`Strength`/`Stamina`/`Dexterity`/`Luck`/`Willpower`) in one activation — there's no partial reveal. `useCharacterAttributes` fetches them with one `getAttributes()` call, gated on `state === 'live'`.

---

## File structure

```
lib/character/
  avatarImage.ts              modified — add UploadedAvatar interface
  creationProgress.ts          new — pure on-chain-state derivation
  creationProgress.test.ts     new

hooks/
  useCharacterCreationProgress.ts  modified — setInterval polling → useQuery
  usePendingCharacters.ts          new — react-query wrapper over pendingCharacters.ts
  useCharacterAttributes.ts        new — reveals real attributes once live

components/Character/
  CharacterSheetPreview.tsx    new — shared avatar/name/description + attribute placeholders
  CreationTracker.tsx          new — invisible, keeps a pending character's progress query alive
  CharacterCreateForm.tsx      new — the single-screen form
  CreateWizard/                deleted (all 7 files)

components/
  Header.tsx                   modified — status dot + CreationTracker mounts

pages/character/
  create.tsx                   modified — renders CharacterCreateForm
  [contractId].tsx              new — materializing/progress page
```

---

## Task 1: `UploadedAvatar` type

**Files:**
- Modify: `lib/character/avatarImage.ts`

- [ ] **Step 1: Add the interface**

Add to `lib/character/avatarImage.ts`, after the existing `CroppedImage` interface (around line 25):

```ts
/** Shape returned by POST /api/character/upload-avatar. Lives here (not in a
 * component) because both the create form and any future avatar-edit UI need
 * it, and it's conceptually part of this module's avatar-handling contract. */
export interface UploadedAvatar {
    ipfsCid: string;
    mimeType: string;
    url: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/character/avatarImage.ts
git commit -m "feat(character): add UploadedAvatar type to avatarImage module"
```

---

## Task 2: Pure on-chain progress state derivation

Extracts the 4-state branching logic out of the polling hook so it's unit-testable without React/DOM.

**Files:**
- Create: `lib/character/creationProgress.ts`
- Test: `lib/character/creationProgress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/character/creationProgress.test.ts
import { describe, it, expect } from 'vitest';
import { deriveProgressState } from './creationProgress';

describe('deriveProgressState', () => {
    it('is pending when neither transaction has landed in a block', () => {
        expect(deriveProgressState(-1, -1)).toBe('pending');
    });

    it('is deployed once tx1 has landed but tx2 has not', () => {
        expect(deriveProgressState(0, -1)).toBe('deployed');
        expect(deriveProgressState(5, -1)).toBe('deployed');
    });

    it('is funding_settled once tx2 has 0 confirmations', () => {
        expect(deriveProgressState(1, 0)).toBe('funding_settled');
    });

    it('is live once tx2 has 1 or more confirmations', () => {
        expect(deriveProgressState(2, 1)).toBe('live');
        expect(deriveProgressState(10, 5)).toBe('live');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/character/creationProgress.test.ts`
Expected: FAIL with "Cannot find module './creationProgress'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/character/creationProgress.ts
import type { PendingCharacterState } from './pendingCharacters';

/**
 * Derives the 4-state on-chain progress model (Pending -> Deployed ->
 * Funding settled -> Live) from raw transaction confirmation counts.
 * -1 means "absent" (still in the mempool, never included in a block).
 */
export function deriveProgressState(
    tx1Confirmations: number,
    tx2Confirmations: number,
): PendingCharacterState {
    if (tx2Confirmations >= 1) return 'live';
    if (tx2Confirmations >= 0) return 'funding_settled';
    if (tx1Confirmations >= 0) return 'deployed';
    return 'pending';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/character/creationProgress.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/character/creationProgress.ts lib/character/creationProgress.test.ts
git commit -m "feat(character): extract pure on-chain progress state derivation"
```

---

## Task 3: Refactor `useCharacterCreationProgress` onto `useQuery`

**Files:**
- Modify: `hooks/useCharacterCreationProgress.ts` (full rewrite)

- [ ] **Step 1: Replace the implementation**

```ts
// hooks/useCharacterCreationProgress.ts
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ledger } from '@signumjs/core';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { deriveProgressState } from '@lib/character/creationProgress';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

export interface CreationProgress {
    /** 'needs_funding' and 'failed' are never produced by this hook — they're
     * set directly on the pendingCharacters entry by the caller before/around
     * the point where this hook has both tx ids to poll. */
    state: PendingCharacterState;
    elapsedMs: number;
}

const POLL_INTERVAL_MS = 15 * 1000;

async function fetchProgressState(ledger: Ledger, tx1Id: string, tx2Id: string): Promise<PendingCharacterState> {
    const [tx1, tx2] = await Promise.all([
        ledger.transaction.getTransaction(tx1Id),
        ledger.transaction.getTransaction(tx2Id),
    ]);
    // Absent `confirmations` means still in the mempool (never included in a
    // block yet); present means >= 0 confirmations.
    return deriveProgressState(tx1.confirmations ?? -1, tx2.confirmations ?? -1);
}

export const useCharacterCreationProgress = (tx1Id: string | null, tx2Id: string | null): CreationProgress => {
    const ledger = useSignumLedger();
    const startRef = useRef(Date.now());
    const [elapsedMs, setElapsedMs] = useState(0);

    const { data: state = 'pending' } = useQuery({
        queryKey: ['characterProgress', tx1Id, tx2Id],
        queryFn: () => {
            if (!ledger || !tx1Id || !tx2Id) return Promise.resolve<PendingCharacterState>('pending');
            return fetchProgressState(ledger, tx1Id, tx2Id);
        },
        enabled: !!ledger && !!tx1Id && !!tx2Id,
        refetchInterval: query => (query.state.data === 'live' ? false : POLL_INTERVAL_MS),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!tx1Id || !tx2Id || state === 'live') return;
        const timer = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);
        return () => clearInterval(timer);
    }, [tx1Id, tx2Id, state]);

    return { state, elapsedMs };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/useCharacterCreationProgress.ts`

- [ ] **Step 3: Run the existing test suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: all existing tests still PASS (this hook itself has no direct test — its branching logic is covered by `creationProgress.test.ts` from Task 2)

- [ ] **Step 4: Commit**

```bash
git add hooks/useCharacterCreationProgress.ts
git commit -m "refactor(character): move creation-progress polling onto react-query"
```

---

## Task 4: `usePendingCharacters` hook

**Files:**
- Create: `hooks/usePendingCharacters.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/usePendingCharacters.ts
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getPendingCharacters,
    upsertPendingCharacter,
    updatePendingCharacter,
    type PendingCharacter,
} from '@lib/character/pendingCharacters';

const pendingCharactersQueryKey = (accountId: string | null) => ['pendingCharacters', accountId] as const;

interface UsePendingCharactersResult {
    characters: PendingCharacter[];
    upsert: (character: PendingCharacter) => void;
    update: (contractId: string, patch: Partial<PendingCharacter>) => void;
}

/**
 * Thin react-query wrapper over the pendingCharacters localStorage module.
 * Every component that calls this with the same accountId shares one cache
 * entry, so a write from one component (e.g. the create form) is immediately
 * visible to every other mounted consumer (e.g. the header badge) via
 * invalidation — no separate event bus or Context provider needed.
 */
export const usePendingCharacters = (accountId: string | null): UsePendingCharactersResult => {
    const queryClient = useQueryClient();

    const { data: characters = [] } = useQuery({
        queryKey: pendingCharactersQueryKey(accountId),
        queryFn: () => {
            if (!accountId) return [];
            return getPendingCharacters(accountId);
        },
        enabled: !!accountId,
        staleTime: Infinity, // only ever changes via the explicit writes below
    });

    const upsert = useCallback(
        (character: PendingCharacter) => {
            if (!accountId) return;
            upsertPendingCharacter(accountId, character);
            queryClient.invalidateQueries({ queryKey: pendingCharactersQueryKey(accountId) });
        },
        [accountId, queryClient],
    );

    const update = useCallback(
        (contractId: string, patch: Partial<PendingCharacter>) => {
            if (!accountId) return;
            updatePendingCharacter(accountId, contractId, patch);
            queryClient.invalidateQueries({ queryKey: pendingCharactersQueryKey(accountId) });
        },
        [accountId, queryClient],
    );

    return { characters, upsert, update };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/usePendingCharacters.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/usePendingCharacters.ts
git commit -m "feat(character): add usePendingCharacters react-query hook"
```

---

## Task 5: `useCharacterAttributes` hook

**Files:**
- Create: `hooks/useCharacterAttributes.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/useCharacterAttributes.ts
import { useQuery } from '@tanstack/react-query';
import { ReadOnlyPlayer, type Attributes } from '@signarank/client';
import { useSignumLedger } from '@hooks/useSignumLedger';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

interface UseCharacterAttributesResult {
    attributes: Attributes | null;
}

/**
 * Reveals a character's 5 rolled attributes once it's live. Mirrors the
 * ReadOnlyPlayer/.character() read pattern useConstruct.ts already uses for
 * constructs. Only ever enabled once `state === 'live'` — before that, the
 * contract hasn't run init() yet and getAttributes() would read nothing.
 */
export const useCharacterAttributes = (
    contractId: string | null,
    state: PendingCharacterState,
): UseCharacterAttributesResult => {
    const ledger = useSignumLedger();

    const { data: attributes } = useQuery({
        queryKey: ['characterAttributes', contractId],
        queryFn: async () => {
            if (!ledger || !contractId) return null;
            const player = new ReadOnlyPlayer({ ledger, accountId: '' });
            return player.character(contractId).getAttributes();
        },
        enabled: !!ledger && !!contractId && state === 'live',
        staleTime: Infinity, // attributes never change after being rolled once
    });

    return { attributes: attributes ?? null };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/useCharacterAttributes.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/useCharacterAttributes.ts
git commit -m "feat(character): add useCharacterAttributes hook"
```

---

## Task 6: `CharacterSheetPreview` component

**Files:**
- Create: `components/Character/CharacterSheetPreview.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/Character/CharacterSheetPreview.tsx
import React from 'react';
import type { Attributes } from '@signarank/client';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';
import { useCharacterAttributes } from '@hooks/useCharacterAttributes';

const ATTRIBUTE_ROWS: { key: keyof Attributes; label: string }[] = [
    { key: 'strength', label: 'Strength' },
    { key: 'stamina', label: 'Stamina' },
    { key: 'dexterity', label: 'Dexterity' },
    { key: 'luck', label: 'Luck' },
    { key: 'willpower', label: 'Willpower' },
];

const STEP_LABELS = ['Pending', 'Deployed', 'Funding settled', 'Live'];

const STEP_INDEX: Record<PendingCharacterState, number> = {
    pending: 0,
    deployed: 1,
    needs_funding: 1,
    funding_settled: 2,
    live: 3,
    failed: -1,
};

export interface CharacterSheetProgress {
    contractId: string;
    state: PendingCharacterState;
    elapsedMs: number;
}

export interface CharacterSheetPreviewProps {
    name: string;
    description: string;
    avatarUrl: string | null;
    /**
     * Presence switches the card into "materializing" mode: renders the
     * 4-dot progress stepper and shimmers the attribute placeholders instead
     * of showing them as flatly, permanently unknown. Omitted on the create
     * form, where nothing is in progress on-chain yet.
     */
    progress?: CharacterSheetProgress;
}

export const CharacterSheetPreview: React.FC<CharacterSheetPreviewProps> = ({
    name,
    description,
    avatarUrl,
    progress,
}) => {
    const { attributes } = useCharacterAttributes(progress?.contractId ?? null, progress?.state ?? 'pending');
    const isResolving = !!progress && progress.state !== 'live';
    const stepIndex = progress ? STEP_INDEX[progress.state] : -1;

    return (
        <div className="glass-static overflow-hidden p-5">
            <div className="flex items-center gap-4 mb-4">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={name || 'Character avatar'}
                        className="w-16 h-16 rounded-full object-cover border border-[var(--gold-dim)] flex-shrink-0"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full border border-dashed border-[var(--glass-border)] flex-shrink-0" />
                )}
                <div className="min-w-0">
                    <h4 className="text-[var(--text)] m-0 truncate">{name || 'Unnamed Character'}</h4>
                    {description && (
                        <p className="text-[0.75rem] text-[var(--text-dim)] m-0 line-clamp-2">{description}</p>
                    )}
                </div>
            </div>

            <ul className="flex flex-col gap-1.5 mb-4">
                {ATTRIBUTE_ROWS.map(row => (
                    <li
                        key={row.key}
                        className="flex items-center justify-between text-[0.75rem] text-[var(--text-dim)]"
                    >
                        <span>{row.label}</span>
                        {attributes ? (
                            <span className="text-[var(--gold)] font-semibold">{attributes[row.key]}</span>
                        ) : (
                            <span
                                className="text-[var(--text-faint)]"
                                style={isResolving ? { animation: 'breathe 2s ease-in-out infinite' } : undefined}
                            >
                                ?
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            {progress && (
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        {STEP_LABELS.map((label, i) => (
                            <div
                                key={label}
                                title={label}
                                className="flex-1 h-1 rounded-full"
                                style={{ background: i <= stepIndex ? 'var(--gold)' : 'var(--glass-border)' }}
                            />
                        ))}
                    </div>
                    <p className="text-[0.7rem] text-[var(--text-faint)] m-0">
                        {Math.floor(progress.elapsedMs / 60000)}m {Math.floor((progress.elapsedMs % 60000) / 1000)}s
                        elapsed
                    </p>
                </div>
            )}
        </div>
    );
};

export default CharacterSheetPreview;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/Character/CharacterSheetPreview.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/Character/CharacterSheetPreview.tsx
git commit -m "feat(character): add shared CharacterSheetPreview component"
```

---

## Task 7: `CreationTracker` component

**Files:**
- Create: `components/Character/CreationTracker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/Character/CreationTracker.tsx
import React, { useEffect } from 'react';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import type { PendingCharacter } from '@lib/character/pendingCharacters';

interface CreationTrackerProps {
    accountId: string;
    character: PendingCharacter;
}

/**
 * Renders nothing. Exists purely to keep a pending character's on-chain
 * progress query alive (and its localStorage state in sync) for as long as
 * the app is mounted, regardless of which page is visible — mounted once per
 * in-flight character by Header.tsx (and, redundantly-but-harmlessly, by
 * /character/[contractId] while that page is open, since react-query
 * dedupes identical queryKeys into one shared poll).
 */
export const CreationTracker: React.FC<CreationTrackerProps> = ({ accountId, character }) => {
    const { update } = usePendingCharacters(accountId);
    const { state } = useCharacterCreationProgress(character.tx1Id, character.tx2Id ?? null);
    const canPoll = !!character.tx1Id && !!character.tx2Id;

    useEffect(() => {
        // Guard on canPoll: when polling is disabled (e.g. tx2 doesn't exist
        // yet, a needs_funding character), the underlying query has no data
        // and `state` falls back to 'pending' — writing that back would
        // incorrectly stomp a real 'needs_funding'/'failed' entry.
        if (!canPoll || state === character.state) return;
        update(character.contractId, { state });
    }, [canPoll, state, character.contractId, character.state, update]);

    return null;
};

export default CreationTracker;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/Character/CreationTracker.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/Character/CreationTracker.tsx
git commit -m "feat(character): add CreationTracker component"
```

---

## Task 8: `CharacterCreateForm` component

**Files:**
- Create: `components/Character/CharacterCreateForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/Character/CharacterCreateForm.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Address } from '@signumjs/core';
import { Amount } from '@signumjs/util';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useCharacterCreation, type CreationStep } from '@hooks/useCharacterCreation';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import { checkImageConstraints, cropAndResizeToDataUrl, type UploadedAvatar } from '@lib/character/avatarImage';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';
import { loadDraft, clearDraft, type PendingCharacter } from '@lib/character/pendingCharacters';
import { CharacterSheetPreview } from './CharacterSheetPreview';

const NAME_MAX_LENGTH = 24;
// deploy fee (1) + funding fee (0.02), matches useCharacterCreation/useCharacterFunding
const NETWORK_FEE_ESTIMATE_SIGNA = 1.02;

const STEP_LABEL: Record<CreationStep, string> = {
    idle: 'Preparing...',
    'awaiting-deploy-signature': 'Step 1 of 2: Approve character deployment in your wallet',
    'awaiting-funding-signature': 'Step 2 of 2: Approve funding transaction in your wallet',
};

export const CharacterCreateForm: React.FC = () => {
    const router = useRouter();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const accountId = useMemo(() => {
        if (!connectedAccount) return null;
        try {
            return Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            return null;
        }
    }, [connectedAccount]);

    const { signaBalance } = useTokenBalances(accountId, []);
    const { create, creating, creationStep } = useCharacterCreation();
    const pendingCharacters = usePendingCharacters(connectedAccount);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [avatar, setAvatar] = useState<UploadedAvatar | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);

    // Resume after a mobile wallet redirect for the deploy signature. The
    // funding signature's redirect now resolves on /character/[contractId].
    useEffect(() => {
        if (!router.isReady || !connectedAccount) return;
        const { mobileCharacterStatus, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } =
                router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setSubmitError('Signing was rejected or failed. Please try again.');
            cleanQuery();
            return;
        }

        const draft = loadDraft(connectedAccount);
        const deployedContractId = mobileCharacterTxId as string;
        if (draft) {
            pendingCharacters.upsert({
                contractId: deployedContractId,
                tx1Id: deployedContractId,
                name: draft.name,
                description: draft.description,
                avatarCid: draft.avatarCid,
                avatarMime: draft.avatarMime,
                avatarUrl: draft.avatarUrl,
                submittedAt: Date.now(),
                state: 'needs_funding',
            });
            clearDraft(connectedAccount);
        }
        cleanQuery();
        router.push(`/character/${deployedContractId}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, connectedAccount]);

    const handleFile = useCallback(async (file: File) => {
        setAvatarError(null);
        setAvatarNotice(null);
        setAvatarUploading(true);
        try {
            const bitmap = await createImageBitmap(file);
            const { needsResize, needsCompress } = checkImageConstraints({
                width: bitmap.width,
                height: bitmap.height,
                sizeBytes: file.size,
            });
            if (needsResize && needsCompress) {
                setAvatarNotice('Image was resized and compressed to fit.');
            } else if (needsResize) {
                setAvatarNotice('Image was resized to fit.');
            } else if (needsCompress) {
                setAvatarNotice('Image was compressed to fit.');
            }

            const { dataUrl, mimeType } = await cropAndResizeToDataUrl(file);
            setPreviewUrl(dataUrl);

            const res = await fetch('/api/character/upload-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl, fileName: file.name || `avatar.${mimeType.split('/')[1]}` }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Upload failed');
            }

            const uploaded: UploadedAvatar = await res.json();
            setAvatar(uploaded);
        } catch (e) {
            setAvatarError(e instanceof Error ? e.message : 'Could not process image');
            setPreviewUrl(null);
            setAvatar(null);
        } finally {
            setAvatarUploading(false);
        }
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!connectedAccount || !avatar) return;
        setSubmitError(undefined);

        const result = await create(
            { name, description },
            { name, description, avatarCid: avatar.ipfsCid, avatarMime: avatar.mimeType, avatarUrl: avatar.url },
        );

        if (!result.success) {
            if (!result.cancelled) setSubmitError(result.error || 'Character creation failed');
            return;
        }

        if (!result.contractId) return;

        const entry: PendingCharacter = {
            contractId: result.contractId,
            tx1Id: result.tx1Id || result.contractId,
            tx1FullHash: result.tx1FullHash,
            tx2Id: result.tx2Id,
            name,
            description,
            avatarCid: avatar.ipfsCid,
            avatarMime: avatar.mimeType,
            avatarUrl: avatar.url,
            submittedAt: Date.now(),
            state: 'deployed',
        };
        pendingCharacters.upsert(entry);
        router.push(`/character/${result.contractId}`);
    }, [connectedAccount, avatar, name, description, create, pendingCharacters, router]);

    if (!connectedAccount) {
        return (
            <div className="glass-static overflow-hidden p-8 text-center">
                <p className="text-[var(--text-dim)] text-[0.9rem]">Connect your wallet to create a character.</p>
            </div>
        );
    }

    const rechargeSigna = parseFloat(Amount.fromPlanck(CharacterCreationCostsPlanck).getSigna());
    const totalRequired = rechargeSigna + NETWORK_FEE_ESTIMATE_SIGNA;
    const insufficientFunds = totalRequired > signaBalance;
    const nameValid = name.trim().length > 0 && name.length <= NAME_MAX_LENGTH;
    const canSubmit = nameValid && !!avatar && !avatarUploading && !insufficientFunds && !creating;

    return (
        <div className="flex flex-col gap-4">
            <div className="glass-static overflow-hidden p-5">
                <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                    Character Name
                    <span className="text-[var(--text-dim)] ml-2 normal-case tracking-normal">
                        ({name.length}/{NAME_MAX_LENGTH})
                    </span>
                </label>
                <input
                    type="text"
                    className="w-full py-2.5 px-3 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-[0.85rem] mb-4 focus:outline-none focus:border-[var(--gold)]"
                    value={name}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={e => setName(e.target.value)}
                    placeholder="Sir Reginald"
                    disabled={creating}
                />

                <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                    Description
                </label>
                <textarea
                    className="w-full py-2.5 px-3 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-[0.85rem] mb-4 focus:outline-none focus:border-[var(--gold)]"
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="A wandering knight seeking glory."
                    disabled={creating}
                />

                <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                    Avatar
                </label>
                {avatarNotice && <p className="text-[0.7rem] text-[var(--text-faint)] mb-2">{avatarNotice}</p>}
                {avatarError && (
                    <div
                        className="mb-3 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        {avatarError}
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    disabled={avatarUploading || creating}
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                    }}
                    className="block w-full text-[0.8rem] text-[var(--text-dim)] mb-1"
                />
                {avatarUploading && <p className="text-[0.75rem] text-[var(--text-dim)]">Uploading...</p>}
            </div>

            <CharacterSheetPreview name={name} description={description} avatarUrl={avatar?.url ?? previewUrl} />

            <div className="glass-static overflow-hidden p-5">
                <div
                    className="mb-4 py-2.5 px-3 rounded-sm text-[0.75rem]"
                    style={{ background: 'rgba(197,164,78,0.04)', border: '1px solid rgba(197,164,78,0.12)' }}
                >
                    <p className="m-0">Character recharge: {rechargeSigna} SIGNA</p>
                    <p className="m-0">Estimated network fees: {NETWORK_FEE_ESTIMATE_SIGNA} SIGNA</p>
                    <p className="m-0 font-semibold">Total: {totalRequired.toFixed(2)} SIGNA</p>
                </div>

                {insufficientFunds && (
                    <div
                        className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        Insufficient balance. You have {signaBalance.toFixed(2)} SIGNA, need{' '}
                        {totalRequired.toFixed(2)} SIGNA.
                    </div>
                )}

                {submitError && (
                    <div
                        className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        {submitError}
                    </div>
                )}

                {creating ? (
                    <p className="text-center text-[0.85rem] text-[var(--text)]">{STEP_LABEL[creationStep]}</p>
                ) : (
                    <button
                        className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                    >
                        Create Character
                    </button>
                )}
            </div>
        </div>
    );
};

export default CharacterCreateForm;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/Character/CharacterCreateForm.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/Character/CharacterCreateForm.tsx
git commit -m "feat(character): add single-screen CharacterCreateForm"
```

---

## Task 9: Wire `/character/create` to the new form

**Files:**
- Modify: `pages/character/create.tsx`

- [ ] **Step 1: Replace the page**

```tsx
// pages/character/create.tsx
import Page from '@components/Page';
import CharacterCreateForm from '@components/Character/CharacterCreateForm';

const CharacterCreatePage = () => (
    <Page title="Create Character - SIGNArank" description="Create your on-chain Character on SignaRank.">
        <div className="content max-w-lg mx-auto py-8 px-4">
            <CharacterCreateForm />
        </div>
    </Page>
);

export default CharacterCreatePage;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `pages/character/create.tsx` (it will still show errors from `CharacterCreateWizard.tsx` and its step files if those haven't been deleted yet — that's expected until Task 12)

- [ ] **Step 3: Commit**

```bash
git add pages/character/create.tsx
git commit -m "feat(character): render CharacterCreateForm on /character/create"
```

---

## Task 10: `/character/[contractId]` progress page

**Files:**
- Create: `pages/character/[contractId].tsx`

- [ ] **Step 1: Write the page**

```tsx
// pages/character/[contractId].tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Page from '@components/Page';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { useCharacterFunding } from '@hooks/useCharacterFunding';
import { CharacterSheetPreview } from '@components/Character/CharacterSheetPreview';
import { CreationTracker } from '@components/Character/CreationTracker';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

const STATE_COPY: Record<PendingCharacterState, string> = {
    pending: 'Broadcasting both transactions...',
    deployed: 'Contract deployed on-chain. Waiting for funding to settle...',
    funding_settled: 'Funded. Waiting for the character to wake up...',
    live: 'Your character is alive!',
    needs_funding: 'Waiting for funding...',
    failed: 'Something went wrong.',
};

const WORST_CASE_MS = 8 * 60 * 1000;

const CharacterProgressPage: React.FC = () => {
    const router = useRouter();
    const contractId = typeof router.query.contractId === 'string' ? router.query.contractId : null;
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const pendingCharacters = usePendingCharacters(connectedAccount);
    const { fund, funding } = useCharacterFunding();
    const [fundError, setFundError] = useState<string | undefined>(undefined);

    const entry = contractId ? pendingCharacters.characters.find(c => c.contractId === contractId) : undefined;
    const canPoll = !!entry?.tx1Id && !!entry?.tx2Id;

    const { state, elapsedMs } = useCharacterCreationProgress(entry?.tx1Id ?? null, entry?.tx2Id ?? null);
    const displayState: PendingCharacterState = canPoll ? state : entry?.state ?? 'pending';

    // Resume after a mobile wallet redirect for the funding signature.
    useEffect(() => {
        if (!router.isReady || !connectedAccount || !contractId) return;
        const { mobileCharacterStatus, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } =
                router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setFundError('Signing was rejected or failed. Please try again.');
            cleanQuery();
            return;
        }

        pendingCharacters.update(contractId, { tx2Id: mobileCharacterTxId as string, state: 'deployed' });
        cleanQuery();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, connectedAccount, contractId]);

    const handleFund = useCallback(async () => {
        if (!contractId) return;
        setFundError(undefined);
        const result = await fund(contractId);
        if (!result.success) {
            if (!result.cancelled) {
                const error = result.error || 'Funding failed';
                setFundError(error);
                // Persist the failure so it survives navigation and the
                // header badge can flip to its "needs attention" state —
                // a plain local error (what the old wizard did) disappears
                // the moment the user leaves this page.
                pendingCharacters.update(contractId, { state: 'failed', error });
            }
            return;
        }
        pendingCharacters.update(contractId, { tx2Id: result.txId, state: 'deployed' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId, fund]);

    if (!connectedAccount) {
        return (
            <Page title="Character - SIGNArank">
                <div className="content max-w-lg mx-auto py-8 px-4">
                    <div className="glass-static overflow-hidden p-8 text-center">
                        <p className="text-[var(--text-dim)] text-[0.9rem]">
                            Connect your wallet to view this character.
                        </p>
                    </div>
                </div>
            </Page>
        );
    }

    if (!entry) {
        return (
            <Page title="Character - SIGNArank">
                <div className="content max-w-lg mx-auto py-8 px-4">
                    <div className="glass-static overflow-hidden p-8 text-center">
                        <p className="text-[var(--text-dim)] text-[0.9rem]">
                            No in-progress character found for this id. It may already be live — a full character
                            dashboard is coming soon.
                        </p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title={`${entry.name} - SIGNArank`} description={`Watch ${entry.name} come to life on SignaRank.`}>
            <div className="content max-w-lg mx-auto py-8 px-4 flex flex-col gap-4">
                {canPoll && <CreationTracker accountId={connectedAccount} character={entry} />}

                <CharacterSheetPreview
                    name={entry.name}
                    description={entry.description}
                    avatarUrl={entry.avatarUrl}
                    progress={{ contractId: entry.contractId, state: displayState, elapsedMs }}
                />

                <div className="glass-static overflow-hidden p-5 text-center">
                    {fundError ? (
                        <p className="text-[0.85rem]" style={{ color: '#ef4444' }}>
                            {fundError}
                        </p>
                    ) : (
                        <>
                            <p className="text-[0.9rem] text-[var(--text)] mb-2">{STATE_COPY[displayState]}</p>
                            {displayState !== 'live' && displayState !== 'needs_funding' && (
                                <p className="text-[0.7rem] text-[var(--text-faint)]">
                                    {Math.floor(elapsedMs / 60000)}m {Math.floor((elapsedMs % 60000) / 1000)}s
                                    elapsed (typically ~4-8 min)
                                </p>
                            )}
                            {elapsedMs > WORST_CASE_MS && displayState !== 'live' && (
                                <p className="text-[0.7rem] mt-2" style={{ color: 'var(--ember)' }}>
                                    This is taking longer than usual — the network may be congested. Your character
                                    is safe; check back here once you have the link.
                                </p>
                            )}
                        </>
                    )}

                    {displayState === 'needs_funding' && (
                        <button
                            className="mt-4 py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                            disabled={funding}
                            onClick={handleFund}
                        >
                            {funding ? 'Confirm in wallet...' : 'Continue: Fund Character'}
                        </button>
                    )}

                    {displayState === 'live' && (
                        <button
                            className="mt-4 py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-not-allowed opacity-60"
                            style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                            disabled
                            title="Character dashboard coming soon"
                        >
                            Character Sheet — Coming Soon
                        </button>
                    )}
                </div>
            </div>
        </Page>
    );
};

export default CharacterProgressPage;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `pages/character/[contractId].tsx`

- [ ] **Step 3: Commit**

```bash
git add "pages/character/[contractId].tsx"
git commit -m "feat(character): add /character/[contractId] progress page"
```

---

## Task 11: Header status badge

**Files:**
- Modify: `components/Header.tsx` (full file replaced below — current file is 80 lines; diff is: 5 new imports, 2 new module-level constants, ~10 new lines of hook/derived-state logic in the component body, the invisible-tracker render, and the two `ConnectButton` wrapper blocks changed from `<div className="hidden md:block">`/`<div className="... flex justify-center">` to include the badge)

- [ ] **Step 1: Replace the file**

```tsx
// components/Header.tsx
import Link from 'next/link';
import React, {useState, useEffect} from 'react';
import {ConnectButton} from '@components/ConnectButton';
import {SeasonBanner} from '@components/SeasonBanner';
import {useRouter} from 'next/router';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {usePendingCharacters} from '@hooks/usePendingCharacters';
import {CreationTracker} from '@components/Character/CreationTracker';
import type {PendingCharacter, PendingCharacterState} from '@lib/character/pendingCharacters';

const AUTO_PROGRESS_STATES: PendingCharacterState[] = ['pending', 'deployed', 'funding_settled'];
const ACTIONABLE_STATES: PendingCharacterState[] = ['needs_funding', 'failed'];

const Header = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();

    // Close menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [router.asPath]);

    const connectedAccount = useAppSelector(selectConnectedAccount);
    const { characters: pendingCharacters } = usePendingCharacters(connectedAccount);

    // Characters whose progress query needs to stay alive site-wide (both tx
    // ids exist, still resolving) — rendered as invisible trackers below.
    const trackedCharacters = pendingCharacters.filter(c => AUTO_PROGRESS_STATES.includes(c.state));
    // Everything the badge itself should represent, including states that
    // need the user's attention rather than automatic on-chain progress.
    const inProgressCharacters = pendingCharacters.filter(
        c => AUTO_PROGRESS_STATES.includes(c.state) || ACTIONABLE_STATES.includes(c.state),
    );
    const needsAction = inProgressCharacters.some(c => ACTIONABLE_STATES.includes(c.state));
    // Click target: prefer whichever character needs the user's action,
    // otherwise the oldest still-auto-progressing one. Works identically
    // whether there's exactly one in-progress character or several.
    const badgeTarget: PendingCharacter | null =
        inProgressCharacters.find(c => ACTIONABLE_STATES.includes(c.state)) ??
        [...inProgressCharacters].sort((a, b) => a.submittedAt - b.submittedAt)[0] ??
        null;

    return (
        <header className="sticky top-0 z-50 bg-[rgba(8,6,12,0.6)] backdrop-blur-[30px] saturate-[1.2] border-b border-[var(--glass-border)]">
            {connectedAccount &&
                trackedCharacters.map(c => (
                    <CreationTracker key={c.contractId} accountId={connectedAccount} character={c} />
                ))}

            <div className="max-w-[1300px] mx-auto px-4 md:px-8 h-[60px] md:h-[70px] flex items-center justify-between">
                {/* Logo + Season Badge */}
                <div className="flex items-center gap-3 md:gap-4">
                    <Link href="/" className="flex items-center gap-2 md:gap-2.5 text-lg md:text-xl tracking-[0.15em]" style={{fontFamily: "'Cinzel', serif", fontWeight: 700}}>
                        <div className="w-8 h-8 md:w-9 md:h-9 border-2 border-[var(--gold)] rounded-full flex items-center justify-center overflow-hidden relative">
                            <img src="/signum-logo.svg" alt="Signum" className="w-4 h-4 md:w-5 md:h-5" />
                            <div className="absolute inset-[3px] border border-[var(--gold-dim)] rounded-full pointer-events-none"/>
                        </div>
                        <span>SIGNA<span className="text-[var(--gold)]">RANK</span></span>
                    </Link>
                    <div className="hidden md:block">
                        <SeasonBanner/>
                    </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-7">
                    <Link href="/" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Home</Link>
                    <Link href="/season" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Season</Link>
                    <Link href="/leaderboard" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Leaderboard</Link>
                    <Link href="/rules" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Rules</Link>
                </nav>

                {/* Desktop Wallet */}
                <div className="hidden md:flex items-center gap-2.5">
                    {badgeTarget && (
                        <Link
                            href={`/character/${badgeTarget.contractId}`}
                            aria-label={needsAction ? 'Character needs your attention' : 'Character creation in progress'}
                            title={needsAction ? 'Character needs your attention' : 'Character creation in progress'}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                                background: needsAction ? 'var(--ember)' : 'var(--gold)',
                                animation: needsAction ? undefined : 'breathe 2s ease-in-out infinite',
                            }}
                        />
                    )}
                    <ConnectButton/>
                </div>

                {/* Mobile hamburger */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="md:hidden flex flex-col gap-1.5 p-2 relative z-[60]"
                    aria-label="Toggle menu"
                >
                    <span className={`block w-5 h-[1.5px] bg-[var(--text)] transition-all duration-200 origin-center ${mobileOpen ? 'rotate-45 translate-y-[4.5px]' : ''}`}/>
                    <span className={`block w-5 h-[1.5px] bg-[var(--text)] transition-all duration-200 origin-center ${mobileOpen ? '-rotate-45 -translate-y-[1.5px]' : ''}`}/>
                </button>
            </div>

            {/* Mobile dropdown overlay */}
            <div className={`md:hidden absolute left-0 right-0 top-full transition-all duration-250 ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className="bg-[rgba(6,4,10,0.96)] backdrop-blur-[40px] border-b border-[var(--glass-border)] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <nav className="flex flex-col px-4 pt-3 pb-2">
                        <Link href="/" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Home</Link>
                        <Link href="/season" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Season</Link>
                        <Link href="/leaderboard" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Leaderboard</Link>
                        <Link href="/rules" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Rules</Link>
                    </nav>
                    <div className="px-4 py-4 border-t border-[var(--glass-border)] flex items-center justify-center gap-2.5">
                        {badgeTarget && (
                            <Link
                                href={`/character/${badgeTarget.contractId}`}
                                aria-label={needsAction ? 'Character needs your attention' : 'Character creation in progress'}
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                    background: needsAction ? 'var(--ember)' : 'var(--gold)',
                                    animation: needsAction ? undefined : 'breathe 2s ease-in-out infinite',
                                }}
                            />
                        )}
                        <ConnectButton/>
                    </div>
                </div>
            </div>

            {/* Backdrop to close menu on tap outside */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 top-[60px] z-[-1]" onClick={() => setMobileOpen(false)} />
            )}
        </header>
    )
}
export default Header;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `components/Header.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/Header.tsx
git commit -m "feat(character): add site-wide creation-status badge to Header"
```

---

## Task 12: Delete the old step-based wizard

**Files:**
- Delete: `components/Character/CreateWizard/NameDescriptionStep.tsx`
- Delete: `components/Character/CreateWizard/AvatarStep.tsx`
- Delete: `components/Character/CreateWizard/ReviewStep.tsx`
- Delete: `components/Character/CreateWizard/CreatingStep.tsx`
- Delete: `components/Character/CreateWizard/ConfirmingStep.tsx`
- Delete: `components/Character/CreateWizard/LiveStep.tsx`
- Delete: `components/Character/CreateWizard/CharacterCreateWizard.tsx`

- [ ] **Step 1: Confirm nothing else references these files**

Run: `grep -rn "CreateWizard" --include="*.tsx" --include="*.ts" pages components hooks lib`
Expected: no matches (Task 9 already repointed `pages/character/create.tsx` to `CharacterCreateForm`)

- [ ] **Step 2: Delete the directory**

```bash
git rm -r components/Character/CreateWizard
```

- [ ] **Step 3: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors, all tests PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(character): remove step-based creation wizard"
```

---

## Task 13: Manual verification

No component-testing setup exists in this repo (matching `AttackForm.tsx`/`ConstructPageBody.tsx` precedent), so this flow is hand-verified in the browser.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the create form**

Navigate to `/character/create` with a connected desktop/extension wallet on testnet:
- Name, description, and avatar fields are all visible in one panel.
- Typing a name updates the `CharacterSheetPreview` card's name live; all 5 attribute rows show a plain `?` (no shimmer — nothing is in progress yet).
- Picking an image immediately shows the resize/compress notice (if applicable), uploads, and swaps the preview avatar.
- The cost breakdown and (if applicable) insufficient-funds warning render without needing name/avatar filled in first.
- "Create Character" stays disabled until name + avatar + sufficient balance are all satisfied.

- [ ] **Step 3: Verify the create → progress handoff**

Click "Create Character", approve both wallet signatures:
- Inline step copy ("Step 1 of 2...", "Step 2 of 2...") replaces the button while signing.
- On success, the browser navigates to `/character/[contractId]`.
- The same character-sheet card now shows a 4-dot stepper and shimmering `?` placeholders.
- Within ~4-8 minutes (2 blocks), the state progresses through Pending → Deployed → Funding settled → Live, and the 5 attributes flip from `?` to real numbers all at once when Live is reached.

- [ ] **Step 4: Verify the header badge**

While the character above is still in progress:
- Navigate to any other page (e.g. `/leaderboard`) — a small gold, gently-pulsing dot appears next to the wallet button.
- Click it — it navigates to `/character/[contractId]` for that character.
- Confirm the dot disappears once the character reaches Live.

- [ ] **Step 5: Verify error handling**

- Reject a wallet signature before any contract exists → inline error on `/character/create`, no header badge appears.
- If testable (requires a mobile wallet or manual state tampering via devtools `localStorage`), verify a `needs_funding` entry shows an ember, non-pulsing badge and that clicking it lands on `/character/[contractId]` with a working "Continue: Fund Character" button.

- [ ] **Step 6: Run the full check suite**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: all PASS

- [ ] **Step 7: Report results**

Summarize what was verified and any deviations found — do not mark this task complete without having actually run the dev server and clicked through the flow.

---

## Follow-up (explicitly out of scope for this plan)

Per the design spec's "Follow-up / explicitly deferred" section:
1. Real discovery/list page (`/character`) — will supersede the header badge's single-target heuristic.
2. Full dashboard rendering for `state === 'live'` on `/character/[contractId]` — this plan only stubs a disabled "Coming Soon" affordance there.
3. Visual polish pass (spacing, iconography, avatar dropzone interaction states, badge/shimmer animation tuning) — implementation-phase work for the frontend-design skill, within the existing Immersive Realm system. This plan intentionally uses plain, already-proven CSS (`glass-static`, existing `breathe` keyframe, existing color variables) rather than inventing new visual treatment.
