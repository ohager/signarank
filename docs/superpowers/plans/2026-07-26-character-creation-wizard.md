# Character Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/character/create`, a wizard (name/description → avatar → review → creating → confirming → live) that lets a connected wallet mint a new Character contract, the first of the three route-level chunks in `docs/superpowers/specs/2026-07-25-character-presentation-design.md` (Part 4, plus the avatar-upload piece of Part 2).

**Architecture:** A client-rendered wizard page drives name/description entry, then an immediate avatar upload (via a new server-side API route that proxies to Pinata+R2), then review, then on-chain creation. On-chain creation is **platform-conditional**: desktop/extension wallets use `Player.createContract({..., shouldChainChargeTransaction: true})` — one atomic call that chains the deploy and funding transactions with Signum's `referencedTransactionFullHash` safety guarantee. Mobile wallets use `shouldChainChargeTransaction: false` (deploy only) followed by a **separate, generic "fund" action** (`useCharacterFunding`), because mobile wallet signing works via app-switching redirects and chaining two signatures inside one continuous async call doesn't survive a page reload. The same `useCharacterFunding` hook will be reused later by the Discovery page's "Resume Funding" recovery action (out of scope for this plan). Once both transactions are signed, the wizard polls their confirmation depth (`useCharacterCreationProgress`) and walks through the spec's 4-state model (Pending → Deployed → Funding settled → Live) before handing off to the dashboard — "Live" specifically means the funding tx has 1 confirmation, since `init()` only runs the block after funding lands.

**Tech Stack:** Next.js Pages Router, React, `@signarank/client@^0.2.6`, `@signumjs/core`/`@signumjs/util`/`@signumjs/wallets`, `pinata` SDK, `@aws-sdk/client-s3`, Vitest (node environment, no jsdom — this repo has no component-testing setup, so step components are hand-verified rather than unit-tested, matching the existing `AttackForm.tsx`/`ConstructPageBody.tsx` precedent).

---

## Design notes (read before starting)

1. **SDK version.** This plan requires `@signarank/client@0.2.6` or later (already bumped in `package.json`/`package-lock.json`). It exposes:
   - `new Player({Ledger, Signer, accountId, gamemasterRegistryId, characterContractReference, cache?})`
   - `player.createContract({name, description?, shouldChainChargeTransaction}): Promise<TransactionId>` where `TransactionId = {transaction: string, fullHash: string}`. `CreateCharacterInstanceArgs` is **not** exported by name — pass an inline object literal, don't try to import the type.
   - No dedicated "fund" method exists in the SDK. Funding is a plain payment built directly with `ledger.transaction.sendAmountToSingleRecipient(...)`, exactly like `Player.attackConstruct()` already does in this codebase (`packages/client/src/player.ts` in `signarank-constructor`).

2. **Required config (values already sourced, testnet):**
   - `NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE=0c17b2d29946df4e6a612fca70bb68a13f20584d4b3949c76dc7256a6633de74`
   - `NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID=4404840052574487680`
   - Neither existed anywhere in this repo before this plan — the `/construct` pages never needed registry-as-config.

3. **Deviation from the original spec's `localStorage` schema:** `PendingCharacter.tx1FullHash` is optional, not required. Mobile's `MobileWallet.parseSignCallback()` (from `@signumjs/wallets@3.3.0`, an external package) only returns `{status, transactionId}` — no `fullHash`. Since mobile never chains (see architecture above), it never needs `tx1FullHash`, so the field is simply absent for mobile-created entries.

4. **Why platform-conditional instead of one code path.** Using the unchained (`false`) two-step flow for *every* platform would be simpler (one code path), but desktop/extension signing resolves in-page with no reload, so it can safely use the atomic chained call and get Signum's stronger confirmation-order guarantee for free. Mobile can't use that path (the redirect breaks the atomic call), so it falls back to two independent steps. This mirrors the SDK author's own stated rationale for adding the flag (see `character.service.ts`'s comment: "signing with mobile wallet is fragile on doing multiple signing actions due to the redirection pattern").

5. **Out of scope for this plan:** the `/character` discovery page, the `/character/[characterId]` dashboard, the "Resume Funding" UI on the discovery page (though the hook it'll use is built here), and the Header nav link (added when Discovery ships, since that's what it links to). This wizard is reachable by direct URL (`/character/create`) until Discovery lands.

---

## File structure

```
lib/character/
  constants.ts                  new — env accessors + cost/size constants
  pendingCharacters.ts           new — localStorage schema for in-flight creations
  pendingCharacters.test.ts      new
  avatarImage.ts                 new — pure validation + browser-only crop/resize
  avatarImage.test.ts            new
  mediaUpload.server.ts          new — ported Pinata+R2 upload logic (Node-standard)
  mediaUpload.server.test.ts     new

pages/api/character/
  upload-avatar.ts               new — server-side upload proxy

hooks/
  useCharacterFunding.ts          new — shared "pay N SIGNA to a contract" action
  useCharacterCreation.ts         new — deploy step, platform-conditional
  useCharacterCreationProgress.ts new — polls tx1/tx2 confirmations, derives the 4-state model

pages/wallet/
  character-signed.tsx           new — mobile redirect callback for character flows

components/Character/CreateWizard/
  CharacterCreateWizard.tsx      new — step orchestrator
  NameDescriptionStep.tsx        new
  AvatarStep.tsx                 new
  ReviewStep.tsx                 new
  CreatingStep.tsx               new — signing phase (waiting on wallet approval)
  ConfirmingStep.tsx             new — confirmation phase (4-state on-chain progress)
  LiveStep.tsx                   new

pages/character/
  create.tsx                     new — page shell

.env.example                     modified — new env vars documented
.env.dev                         modified — testnet values filled in
```

---

## Task 1: Config constants

**Files:**
- Create: `lib/character/constants.ts`
- Test: `lib/character/constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/character/constants.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getCharacterContractReference,
    getGamemasterRegistryId,
    CharacterCreationCostsPlanck,
    AVATAR_MAX_DIMENSION_PX,
    AVATAR_MAX_BYTES,
} from './constants';

describe('character constants', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('reads the character contract reference from env', () => {
        process.env.NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE = 'abc123';
        expect(getCharacterContractReference()).toBe('abc123');
    });

    it('falls back to empty string when the contract reference env var is unset', () => {
        delete process.env.NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE;
        expect(getCharacterContractReference()).toBe('');
    });

    it('reads the gamemaster registry id from env', () => {
        process.env.NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID = '4404840052574487680';
        expect(getGamemasterRegistryId()).toBe('4404840052574487680');
    });

    it('falls back to empty string when the registry id env var is unset', () => {
        delete process.env.NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID;
        expect(getGamemasterRegistryId()).toBe('');
    });

    it('exposes fixed cost and size constants', () => {
        expect(CharacterCreationCostsPlanck).toBe('1000000000');
        expect(AVATAR_MAX_DIMENSION_PX).toBe(1024);
        expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/character/constants.test.ts`
Expected: FAIL with "Cannot find module './constants'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/character/constants.ts

/** Cost to fund a newly-deployed character's first activation. Must match
 * @signarank/services' CharacterCreationCostsPlanck (character.constants.ts). */
export const CharacterCreationCostsPlanck = '1000000000'; // 10 SIGNA

export const AVATAR_MAX_DIMENSION_PX = 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

/** Reference tx (full hash) of the currently-deployed "green" Character
 * contract bytecode. Required by Player.createContract(). */
export const getCharacterContractReference = (): string =>
    process.env.NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE || '';

/** Deployed Gamemaster Registry account id — the single source of truth
 * Player/CharacterService resolve the char registry and xp token through. */
export const getGamemasterRegistryId = (): string =>
    process.env.NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID || '';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/character/constants.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Add the env vars to `.env.example` and `.env.dev`**

Modify `.env.example` — add a new section after the existing "Construct Game Feature" block:

```
# Character Game Feature
# Deployed Gamemaster Registry account id (registry-as-config source of truth)
NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID=
# Reference tx (full hash) of the currently-deployed "green" Character contract
NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE=
```

Modify `.env.dev` — add the same two keys with the sourced testnet values:

```
NEXT_PUBLIC_GAMEMASTER_REGISTRY_ID=4404840052574487680
NEXT_PUBLIC_CHARACTER_CONTRACT_REFERENCE=0c17b2d29946df4e6a612fca70bb68a13f20584d4b3949c76dc7256a6633de74
```

- [ ] **Step 6: Commit**

```bash
git add lib/character/constants.ts lib/character/constants.test.ts .env.example .env.dev
git commit -m "feat(character): add config constants for creation wizard"
```

---

## Task 2: Pending-character localStorage schema

**Files:**
- Create: `lib/character/pendingCharacters.ts`
- Test: `lib/character/pendingCharacters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/character/pendingCharacters.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
    getPendingCharacters,
    upsertPendingCharacter,
    updatePendingCharacter,
    removePendingCharacter,
    saveDraft,
    loadDraft,
    clearDraft,
    type PendingCharacter,
} from './pendingCharacters';

class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() { return this.store.size; }
    clear() { this.store.clear(); }
    getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
    key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
    removeItem(key: string) { this.store.delete(key); }
    setItem(key: string, value: string) { this.store.set(key, value); }
}

const ACCOUNT = '12345678901234567890';

const sample = (contractId: string): PendingCharacter => ({
    contractId,
    tx1Id: `${contractId}-tx1`,
    name: 'Test Hero',
    description: 'A test character',
    avatarCid: 'bafy123',
    avatarMime: 'image/png',
    avatarUrl: 'https://r2.signarank.club/bafy123',
    submittedAt: Date.now(),
    state: 'pending',
});

describe('pendingCharacters', () => {
    let storage: Storage;

    beforeEach(() => {
        storage = new MemoryStorage();
    });

    it('returns an empty array when nothing is stored', () => {
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('upserts a new entry', () => {
        const entry = sample('111');
        upsertPendingCharacter(ACCOUNT, entry, storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([entry]);
    });

    it('upserting an existing contractId replaces it rather than duplicating', () => {
        const entry = sample('111');
        upsertPendingCharacter(ACCOUNT, entry, storage);
        upsertPendingCharacter(ACCOUNT, { ...entry, state: 'deployed' }, storage);
        const all = getPendingCharacters(ACCOUNT, storage);
        expect(all).toHaveLength(1);
        expect(all[0]!.state).toBe('deployed');
    });

    it('scopes entries by accountId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        upsertPendingCharacter('other-account', sample('222'), storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toHaveLength(1);
        expect(getPendingCharacters('other-account', storage)).toHaveLength(1);
    });

    it('patches an existing entry by contractId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        updatePendingCharacter(ACCOUNT, '111', { state: 'funding_settled', tx2Id: 'tx2-abc' }, storage);
        const [updated] = getPendingCharacters(ACCOUNT, storage);
        expect(updated!.state).toBe('funding_settled');
        expect(updated!.tx2Id).toBe('tx2-abc');
    });

    it('patching a missing contractId is a no-op', () => {
        updatePendingCharacter(ACCOUNT, 'does-not-exist', { state: 'live' }, storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('removes an entry by contractId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        upsertPendingCharacter(ACCOUNT, sample('222'), storage);
        removePendingCharacter(ACCOUNT, '111', storage);
        const remaining = getPendingCharacters(ACCOUNT, storage);
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.contractId).toBe('222');
    });

    it('ignores malformed stored JSON rather than throwing', () => {
        storage.setItem(`signarank:pendingCharacters:${ACCOUNT}`, '{not valid json');
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('round-trips a creation draft (pre-contractId mobile staging)', () => {
        const draft = {
            name: 'Draft Hero',
            description: 'still deploying',
            avatarCid: 'bafy999',
            avatarMime: 'image/jpeg',
            avatarUrl: 'https://r2.signarank.club/bafy999',
        };
        expect(loadDraft(ACCOUNT, storage)).toBeNull();
        saveDraft(ACCOUNT, draft, storage);
        expect(loadDraft(ACCOUNT, storage)).toEqual(draft);
        clearDraft(ACCOUNT, storage);
        expect(loadDraft(ACCOUNT, storage)).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/character/pendingCharacters.test.ts`
Expected: FAIL with "Cannot find module './pendingCharacters'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/character/pendingCharacters.ts

export type PendingCharacterState =
    | 'pending'
    | 'deployed'
    | 'funding_settled'
    | 'live'
    | 'needs_funding'
    | 'failed';

export interface PendingCharacter {
    contractId: string;
    tx1Id: string;
    /** Only available on desktop/extension (chained) creations — mobile's
     * MobileWallet.parseSignCallback() doesn't return a fullHash. */
    tx1FullHash?: string;
    tx2Id?: string;
    name: string;
    description: string;
    avatarCid: string;
    avatarMime: string;
    avatarUrl: string;
    submittedAt: number;
    state: PendingCharacterState;
    error?: string;
}

export interface CreationDraft {
    name: string;
    description: string;
    avatarCid: string;
    avatarMime: string;
    avatarUrl: string;
}

const storageKey = (accountId: string) => `signarank:pendingCharacters:${accountId}`;
const draftKey = (accountId: string) => `signarank:pendingCharacterDraft:${accountId}`;

const resolveStorage = (storage?: Storage): Storage | null => {
    if (storage) return storage;
    if (typeof window === 'undefined') return null;
    return window.localStorage;
};

export function getPendingCharacters(accountId: string, storage?: Storage): PendingCharacter[] {
    const s = resolveStorage(storage);
    if (!s) return [];
    const raw = s.getItem(storageKey(accountId));
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as PendingCharacter[]) : [];
    } catch {
        return [];
    }
}

function writePendingCharacters(accountId: string, characters: PendingCharacter[], storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(storageKey(accountId), JSON.stringify(characters));
}

export function upsertPendingCharacter(accountId: string, character: PendingCharacter, storage?: Storage): void {
    const existing = getPendingCharacters(accountId, storage);
    const next = existing.filter(c => c.contractId !== character.contractId);
    next.push(character);
    writePendingCharacters(accountId, next, storage);
}

export function updatePendingCharacter(
    accountId: string,
    contractId: string,
    patch: Partial<PendingCharacter>,
    storage?: Storage,
): void {
    const existing = getPendingCharacters(accountId, storage);
    const next = existing.map(c => (c.contractId === contractId ? { ...c, ...patch } : c));
    writePendingCharacters(accountId, next, storage);
}

export function removePendingCharacter(accountId: string, contractId: string, storage?: Storage): void {
    const existing = getPendingCharacters(accountId, storage);
    writePendingCharacters(accountId, existing.filter(c => c.contractId !== contractId), storage);
}

/** Stashes the wizard's composed identity before a mobile deploy-signing
 * redirect, since the page reloads before a contractId (and therefore a
 * PendingCharacter entry) exists yet. */
export function saveDraft(accountId: string, draft: CreationDraft, storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(draftKey(accountId), JSON.stringify(draft));
}

export function loadDraft(accountId: string, storage?: Storage): CreationDraft | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const raw = s.getItem(draftKey(accountId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CreationDraft;
    } catch {
        return null;
    }
}

export function clearDraft(accountId: string, storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.removeItem(draftKey(accountId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/character/pendingCharacters.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/character/pendingCharacters.ts lib/character/pendingCharacters.test.ts
git commit -m "feat(character): add localStorage schema for in-flight creations"
```

---

## Task 3: Avatar image validation

**Files:**
- Create: `lib/character/avatarImage.ts`
- Test: `lib/character/avatarImage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/character/avatarImage.test.ts
import { describe, it, expect } from 'vitest';
import { checkImageConstraints } from './avatarImage';

describe('checkImageConstraints', () => {
    it('flags nothing for an image already within bounds', () => {
        const result = checkImageConstraints({ width: 512, height: 512, sizeBytes: 500_000 });
        expect(result).toEqual({ needsResize: false, needsCompress: false });
    });

    it('flags resize when either dimension exceeds the 1024px cap', () => {
        expect(checkImageConstraints({ width: 2000, height: 512, sizeBytes: 500_000 })).toEqual({
            needsResize: true,
            needsCompress: false,
        });
        expect(checkImageConstraints({ width: 512, height: 2000, sizeBytes: 500_000 })).toEqual({
            needsResize: true,
            needsCompress: false,
        });
    });

    it('flags compress when size exceeds the 2MiB cap', () => {
        const result = checkImageConstraints({ width: 512, height: 512, sizeBytes: 3 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: false, needsCompress: true });
    });

    it('flags both when both bounds are exceeded', () => {
        const result = checkImageConstraints({ width: 4000, height: 4000, sizeBytes: 5 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: true, needsCompress: true });
    });

    it('treats exactly-at-the-cap dimensions and size as within bounds', () => {
        const result = checkImageConstraints({ width: 1024, height: 1024, sizeBytes: 2 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: false, needsCompress: false });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/character/avatarImage.test.ts`
Expected: FAIL with "Cannot find module './avatarImage'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/character/avatarImage.ts
import { AVATAR_MAX_DIMENSION_PX, AVATAR_MAX_BYTES } from './constants';

export interface ImageDimensions {
    width: number;
    height: number;
    sizeBytes: number;
}

export interface ImageConstraintCheck {
    needsResize: boolean;
    needsCompress: boolean;
}

/** Pure bounds check — no DOM access, safe to unit test under Node. */
export function checkImageConstraints(dims: ImageDimensions): ImageConstraintCheck {
    return {
        needsResize: dims.width > AVATAR_MAX_DIMENSION_PX || dims.height > AVATAR_MAX_DIMENSION_PX,
        needsCompress: dims.sizeBytes > AVATAR_MAX_BYTES,
    };
}

export interface CroppedImage {
    dataUrl: string;
    mimeType: string;
}

/**
 * Browser-only: reads an image File, center-crops it to a square, resizes it
 * to fit within AVATAR_MAX_DIMENSION_PX, and re-encodes as JPEG at a quality
 * chosen to fit under AVATAR_MAX_BYTES. Not unit-tested (needs canvas/Image,
 * which this repo's Vitest setup doesn't provide) — verify manually in the
 * browser per Task 9's checklist. Mirrors how other DOM-heavy code in this
 * repo (e.g. components/Construct/AttackForm.tsx) has no unit test either.
 */
export async function cropAndResizeToDataUrl(file: File): Promise<CroppedImage> {
    const imageBitmap = await createImageBitmap(file);
    const side = Math.min(imageBitmap.width, imageBitmap.height);
    const sx = (imageBitmap.width - side) / 2;
    const sy = (imageBitmap.height - side) / 2;
    const targetSide = Math.min(side, AVATAR_MAX_DIMENSION_PX);

    const canvas = document.createElement('canvas');
    canvas.width = targetSide;
    canvas.height = targetSide;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(imageBitmap, sx, sy, side, side, 0, 0, targetSide, targetSide);

    let quality = 0.92;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length * 0.75 > AVATAR_MAX_BYTES && quality > 0.4) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return { dataUrl, mimeType: 'image/jpeg' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/character/avatarImage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/character/avatarImage.ts lib/character/avatarImage.test.ts
git commit -m "feat(character): add avatar dimension/size validation"
```

---

## Task 4: Server-side media upload (Pinata + R2)

Ports `packages/services/src/media/media.upload.service.ts` (in `signarank-constructor`) from Bun-specific APIs (`Bun.S3Client`, filesystem paths) to Node-standard equivalents (`@aws-sdk/client-s3`, in-memory buffers from a data URL — this repo never receives a filesystem path, only a base64 data URL from the browser).

**Files:**
- Create: `lib/character/mediaUpload.server.ts`
- Test: `lib/character/mediaUpload.server.test.ts`

- [ ] **Step 1: Install new dependencies**

Run: `npm install pinata @aws-sdk/client-s3`
Expected: both added to `dependencies` in `package.json`

- [ ] **Step 2: Write the failing test**

```ts
// lib/character/mediaUpload.server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadFileMock = vi.fn();
const s3SendMock = vi.fn();

vi.mock('pinata', () => ({
    PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { public: { file: uploadFileMock } },
    })),
}));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3SendMock })),
    PutObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { createCharacterMediaUploadService } from './mediaUpload.server';

const CONFIG = {
    pinata: { jwt: 'test-jwt', gateway: 'gateway.test' },
    r2: {
        accountId: 'acct',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucketName: 'bucket',
        publicUrl: 'https://r2.signarank.club',
    },
};

describe('createCharacterMediaUploadService', () => {
    beforeEach(() => {
        uploadFileMock.mockReset();
        s3SendMock.mockReset();
    });

    it('uploads a data URL to Pinata then R2, returning ipfsCid/mimeType/url', async () => {
        uploadFileMock.mockResolvedValue({ cid: 'bafy123' });
        s3SendMock.mockResolvedValue({});

        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/jpeg;base64,${Buffer.from('fake-image-bytes').toString('base64')}`;
        const result = await service.uploadFromDataUrl(dataUrl, 'avatar.jpg');

        expect(result).toEqual({
            ipfsCid: 'bafy123',
            mimeType: 'image/jpeg',
            url: 'https://r2.signarank.club/bafy123',
        });
        expect(uploadFileMock).toHaveBeenCalledTimes(1);
        expect(s3SendMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed data URL before calling either upstream service', async () => {
        const service = createCharacterMediaUploadService(CONFIG);
        await expect(service.uploadFromDataUrl('not-a-data-url', 'avatar.jpg')).rejects.toThrow(
            'Invalid data URL format',
        );
        expect(uploadFileMock).not.toHaveBeenCalled();
        expect(s3SendMock).not.toHaveBeenCalled();
    });

    it('wraps a Pinata failure with context', async () => {
        uploadFileMock.mockRejectedValue(new Error('pinata down'));
        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;
        await expect(service.uploadFromDataUrl(dataUrl, 'a.png')).rejects.toThrow(/Failed to upload to Pinata/);
    });

    it('wraps an R2 failure with context', async () => {
        uploadFileMock.mockResolvedValue({ cid: 'bafy999' });
        s3SendMock.mockRejectedValue(new Error('r2 down'));
        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;
        await expect(service.uploadFromDataUrl(dataUrl, 'a.png')).rejects.toThrow(/Failed to upload to R2/);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/character/mediaUpload.server.test.ts`
Expected: FAIL with "Cannot find module './mediaUpload.server'"

- [ ] **Step 4: Write the implementation**

```ts
// lib/character/mediaUpload.server.ts
import { PinataSDK } from 'pinata';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface PinataConfig {
    jwt: string;
    gateway: string;
}

export interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
}

export interface UploadConfig {
    pinata: PinataConfig;
    r2: R2Config;
}

export interface UploadResult {
    ipfsCid: string;
    mimeType: string;
    url: string;
}

export interface CharacterMediaUploadService {
    uploadFromDataUrl(dataUrl: string, fileName: string): Promise<UploadResult>;
}

/**
 * Node-standard port of signarank-constructor's MediaUploadService
 * (packages/services/src/media/media.upload.service.ts), which targets Bun
 * (Bun.S3Client, filesystem paths) and isn't installed in this repo. This
 * app only ever has a base64 data URL from the browser's canvas crop step,
 * never a filesystem path, so only that entry point is ported.
 */
export function createCharacterMediaUploadService(config: UploadConfig): CharacterMediaUploadService {
    const pinataClient = new PinataSDK({
        pinataJwt: config.pinata.jwt,
        pinataGateway: config.pinata.gateway,
    });

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    async function uploadToPinata(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
        try {
            const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });
            const upload = await pinataClient.upload.public.file(file);
            return upload.cid;
        } catch (error) {
            throw new Error(`Failed to upload to Pinata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async function uploadToR2(fileBuffer: Buffer, ipfsCid: string, mimeType: string): Promise<string> {
        try {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: config.r2.bucketName,
                    Key: ipfsCid,
                    Body: fileBuffer,
                    ContentType: mimeType,
                }),
            );
            return `${config.r2.publicUrl}/${ipfsCid}`;
        } catch (error) {
            throw new Error(`Failed to upload to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return {
        async uploadFromDataUrl(dataUrl: string, fileName: string): Promise<UploadResult> {
            const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
            if (!matches || !matches[1] || !matches[2]) {
                throw new Error('Invalid data URL format');
            }
            const mimeType = matches[1];
            const fileBuffer = Buffer.from(matches[2], 'base64');

            const ipfsCid = await uploadToPinata(fileBuffer, fileName, mimeType);
            const url = await uploadToR2(fileBuffer, ipfsCid, mimeType);

            return { ipfsCid, mimeType, url };
        },
    };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/character/mediaUpload.server.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/character/mediaUpload.server.ts lib/character/mediaUpload.server.test.ts
git commit -m "feat(character): port Pinata+R2 media upload service to Node"
```

---

## Task 5: Avatar upload API route

**Files:**
- Create: `pages/api/character/upload-avatar.ts`

- [ ] **Step 1: Add the new server-only env vars to `.env.example`**

Append to the "SERVER SIDE **SENSITIVE** DATA" section of `.env.example`:

```
# Character avatar uploads (Pinata + Cloudflare R2)
PINATA_JWT=
PINATA_GATEWAY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

- [ ] **Step 2: Write the route**

```ts
// pages/api/character/upload-avatar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createCharacterMediaUploadService } from '@lib/character/mediaUpload.server';
import { AVATAR_MAX_BYTES } from '@lib/character/constants';
import { R2_CDN_BASE } from '@lib/construct/constants';

export const config = {
    api: {
        // Base64 data URLs run ~33% larger than the underlying binary, plus
        // JSON overhead — pad generously above AVATAR_MAX_BYTES (2MiB).
        bodyParser: { sizeLimit: '4mb' },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { dataUrl, fileName } = req.body ?? {};

    if (typeof dataUrl !== 'string' || !dataUrl || typeof fileName !== 'string' || !fileName) {
        return res.status(400).json({ error: 'Missing required fields: dataUrl, fileName' });
    }

    const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
    const approxBytes = base64Length * 0.75;
    if (approxBytes > AVATAR_MAX_BYTES) {
        return res.status(413).json({ error: 'Image exceeds maximum size' });
    }

    const { PINATA_JWT, PINATA_GATEWAY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
        process.env;

    if (!PINATA_JWT || !PINATA_GATEWAY || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        console.error('upload-avatar: missing upload service configuration');
        return res.status(500).json({ error: 'Upload service is not configured' });
    }

    try {
        const service = createCharacterMediaUploadService({
            pinata: { jwt: PINATA_JWT, gateway: PINATA_GATEWAY },
            r2: {
                accountId: R2_ACCOUNT_ID,
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
                bucketName: R2_BUCKET_NAME,
                // Character avatars mirror into the same bucket/CDN base
                // constructs already use (per the design spec, Part 2's
                // "Current state" — "character avatars mirror into the same
                // bucket, new object keys"), not a new per-feature subdomain.
                publicUrl: R2_CDN_BASE,
            },
        });

        const result = await service.uploadFromDataUrl(dataUrl, fileName);
        return res.status(200).json(result);
    } catch (err) {
        console.error('upload-avatar error:', err);
        return res.status(502).json({ error: 'Avatar upload failed' });
    }
}
```

- [ ] **Step 3: Manual verification**

With real Pinata/R2 credentials in `.env`, run `npm run dev` and:

```bash
curl -X POST http://localhost:3000/api/character/upload-avatar \
  -H "Content-Type: application/json" \
  -d '{"dataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","fileName":"test.png"}'
```

Expected: `200` with `{"ipfsCid": "...", "mimeType": "image/png", "url": "..."}`; the `url` resolves to the uploaded image.

- [ ] **Step 4: Commit**

```bash
git add pages/api/character/upload-avatar.ts .env.example
git commit -m "feat(character): add avatar upload API route"
```

---

## Task 6: Shared character-funding hook

Builds and signs a plain payment of `CharacterCreationCostsPlanck` to a given `contractId`. Used by the mobile creation flow's second step (Task 8) and, later, by the Discovery page's "Resume Funding" recovery action (not built in this plan).

**Files:**
- Create: `hooks/useCharacterFunding.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/useCharacterFunding.ts
import { useState, useCallback } from 'react';
import { Amount } from '@signumjs/util';
import { Signer } from '@signarank/client';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useIsMobile } from '@hooks/useIsMobile';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';

export interface FundResult {
    success: boolean;
    txId?: string;
    error?: string;
    cancelled?: boolean;
}

interface UseCharacterFundingResult {
    fund: (contractId: string) => Promise<FundResult>;
    funding: boolean;
}

export const useCharacterFunding = (): UseCharacterFundingResult => {
    const [funding, setFunding] = useState(false);
    const { Wallet, Ledger } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const isMobile = useIsMobile();

    const fund = useCallback(
        async (contractId: string): Promise<FundResult> => {
            if (!ledger || !connectedAccount) {
                return { success: false, error: 'Wallet not connected' };
            }

            setFunding(true);
            try {
                const controller = new AbortController();

                const signer: Signer = {
                    getPublicKey: async () => connectedAccount,
                    sign: async (unsignedTransactionBytes: string, signal?: AbortSignal) => {
                        if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

                        if (isMobile) {
                            const network = Ledger.Network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';
                            const returnUrl = window.location.pathname + window.location.search;
                            const callbackUrl = `${window.location.origin}/wallet/character-signed?step=fund&returnUrl=${encodeURIComponent(returnUrl)}`;
                            Wallet.Mobile.sign({ unsignedTransactionBytes, callbackUrl, network });
                            return new Promise<never>(() => {});
                        }

                        let confirmed: any;
                        try {
                            confirmed = await Wallet.Extension.confirm(unsignedTransactionBytes);
                        } catch (e) {
                            const name: string = (e as any)?.name ?? '';
                            const msg: string = (e as any)?.message ?? (e as any)?.error ?? '';
                            const isUserDenial =
                                name === 'NotGrantedWalletError' || /cancel|reject|denied|abort|not.granted/i.test(msg);
                            if (isUserDenial) controller.abort();
                            throw new DOMException(isUserDenial ? 'cancelled' : msg || 'Signing failed', 'AbortError');
                        }

                        if (!confirmed) {
                            controller.abort();
                            throw new DOMException('cancelled', 'AbortError');
                        }

                        return { fullHash: confirmed.fullHash, transaction: confirmed.transactionId } as any;
                    },
                };

                const senderPublicKey = await signer.getPublicKey();
                if (!senderPublicKey) {
                    return { success: false, error: 'Wallet has no public key' };
                }

                const unsignedTx = await ledger.transaction.sendAmountToSingleRecipient({
                    senderPublicKey,
                    feePlanck: Amount.fromSigna('0.02').getPlanck(),
                    amountPlanck: Amount.fromPlanck(CharacterCreationCostsPlanck).getPlanck(),
                    recipientId: contractId,
                });

                const signed = (await signer.sign(unsignedTx.unsignedTransactionBytes, controller.signal)) as any;

                return { success: true, txId: signed.transaction };
            } catch (e) {
                const isCancelled = e instanceof DOMException && e.name === 'AbortError';
                if (isCancelled) return { success: false, cancelled: true };
                const errorMessage = e instanceof Error ? e.message : 'Funding failed';
                return { success: false, error: errorMessage };
            } finally {
                setFunding(false);
            }
        },
        [ledger, connectedAccount, Wallet, Ledger, isMobile],
    );

    return { fund, funding };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/useCharacterFunding.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/useCharacterFunding.ts
git commit -m "feat(character): add shared character-funding hook"
```

---

## Task 7: Character creation hook

Handles the deploy step. Desktop/extension does the full chained create in one call; mobile does deploy-only and lets the wizard invoke `useCharacterFunding` as an explicit second step.

**Files:**
- Create: `hooks/useCharacterCreation.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/useCharacterCreation.ts
import { useState, useCallback } from 'react';
import { Player, Signer } from '@signarank/client';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useIsMobile } from '@hooks/useIsMobile';
import { getCharacterContractReference, getGamemasterRegistryId } from '@lib/character/constants';
import { saveDraft, type CreationDraft } from '@lib/character/pendingCharacters';

export type CreationStep = 'idle' | 'awaiting-deploy-signature' | 'awaiting-funding-signature';

export interface CreateCharacterParams {
    name: string;
    description: string;
}

export interface CreationResult {
    success: boolean;
    /** Populated once the deploy tx is known — same value on desktop
     * (fully chained) and mobile (deploy-only, funding is a separate step). */
    contractId?: string;
    tx1Id?: string;
    tx1FullHash?: string;
    tx2Id?: string;
    /** True on mobile: deploy succeeded but funding still needs an explicit
     * second signature via useCharacterFunding().fund(contractId). */
    needsFunding?: boolean;
    error?: string;
    cancelled?: boolean;
}

interface UseCharacterCreationResult {
    create: (params: CreateCharacterParams, draft: CreationDraft) => Promise<CreationResult>;
    creating: boolean;
    creationStep: CreationStep;
}

export const useCharacterCreation = (): UseCharacterCreationResult => {
    const [creating, setCreating] = useState(false);
    const [creationStep, setCreationStep] = useState<CreationStep>('idle');
    const { Wallet, Ledger } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const isMobile = useIsMobile();

    const create = useCallback(
        async (params: CreateCharacterParams, draft: CreationDraft): Promise<CreationResult> => {
            if (!ledger || !connectedAccount) {
                return { success: false, error: 'Wallet not connected' };
            }

            setCreating(true);
            setCreationStep('awaiting-deploy-signature');

            try {
                const controller = new AbortController();
                let signCallCount = 0;
                const signResults: any[] = [];

                const signer: Signer = {
                    getPublicKey: async () => connectedAccount,
                    sign: async (unsignedTransactionBytes: string, signal?: AbortSignal) => {
                        if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
                        signCallCount += 1;
                        setCreationStep(signCallCount === 1 ? 'awaiting-deploy-signature' : 'awaiting-funding-signature');

                        if (isMobile) {
                            // Desktop-only atomic path never reaches a second
                            // sign() call on mobile (shouldChainChargeTransaction
                            // is false there), so this only ever fires once here.
                            saveDraft(connectedAccount, draft);
                            const network = Ledger.Network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';
                            const returnUrl = window.location.pathname + window.location.search;
                            const callbackUrl = `${window.location.origin}/wallet/character-signed?step=deploy&returnUrl=${encodeURIComponent(returnUrl)}`;
                            Wallet.Mobile.sign({ unsignedTransactionBytes, callbackUrl, network });
                            return new Promise<never>(() => {});
                        }

                        let confirmed: any;
                        try {
                            confirmed = await Wallet.Extension.confirm(unsignedTransactionBytes);
                        } catch (e) {
                            const name: string = (e as any)?.name ?? '';
                            const msg: string = (e as any)?.message ?? (e as any)?.error ?? '';
                            const isUserDenial =
                                name === 'NotGrantedWalletError' || /cancel|reject|denied|abort|not.granted/i.test(msg);
                            if (isUserDenial) controller.abort();
                            throw new DOMException(isUserDenial ? 'cancelled' : msg || 'Signing failed', 'AbortError');
                        }

                        if (!confirmed) {
                            controller.abort();
                            throw new DOMException('cancelled', 'AbortError');
                        }

                        const result = { fullHash: confirmed.fullHash, transaction: confirmed.transactionId };
                        signResults.push(result);
                        return result as any;
                    },
                };

                const player = new Player({
                    Ledger: ledger,
                    Signer: signer,
                    accountId: connectedAccount,
                    gamemasterRegistryId: getGamemasterRegistryId(),
                    characterContractReference: getCharacterContractReference(),
                });

                const deployTx = await player.createContract({
                    name: params.name,
                    description: params.description,
                    shouldChainChargeTransaction: !isMobile,
                });

                const contractId = deployTx.transaction;

                if (isMobile) {
                    // Mobile navigated away before this line — unreachable in
                    // that branch; kept only so desktop/extension flows below
                    // are typed consistently. Desktop resumes here directly.
                    return { success: true, contractId, tx1Id: contractId, needsFunding: true };
                }

                return {
                    success: true,
                    contractId,
                    tx1Id: signResults[0]?.transaction,
                    tx1FullHash: signResults[0]?.fullHash,
                    tx2Id: signResults[1]?.transaction,
                    needsFunding: false,
                };
            } catch (e) {
                const isCancelled = e instanceof DOMException && e.name === 'AbortError';
                if (isCancelled) return { success: false, cancelled: true };
                const errorMessage = e instanceof Error ? e.message : 'Character creation failed';
                return { success: false, error: errorMessage };
            } finally {
                setCreating(false);
                setCreationStep('idle');
            }
        },
        [ledger, connectedAccount, Wallet, Ledger, isMobile],
    );

    return { create, creating, creationStep };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/useCharacterCreation.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/useCharacterCreation.ts
git commit -m "feat(character): add platform-conditional character creation hook"
```

---

## Task 8: Mobile signed-callback page

A dedicated callback page for character-flow signing (deploy or fund), kept separate from `pages/wallet/signed.tsx` (which hardcodes `mobileAttackStatus`/`mobileAttackTxId` query param names for the already-shipped construct-attack flow) to avoid touching that shipped code path.

**Files:**
- Create: `pages/wallet/character-signed.tsx`

- [ ] **Step 1: Write the page**

```tsx
// pages/wallet/character-signed.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MobileWallet } from '@signumjs/wallets';
import Page from '@components/Page';

const CharacterSignedPage = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!router.isReady) return;
        try {
            const { status, transactionId } = MobileWallet.parseSignCallback();
            const returnUrl = (router.query.returnUrl as string) || '/character/create';
            const step = (router.query.step as string) || 'deploy';
            const sep = returnUrl.includes('?') ? '&' : '?';

            if (status === 'success' && transactionId) {
                router.replace(
                    `${returnUrl}${sep}mobileCharacterStatus=success&mobileCharacterStep=${step}&mobileCharacterTxId=${transactionId}`,
                );
            } else if (status === 'rejected') {
                router.replace(`${returnUrl}${sep}mobileCharacterStatus=rejected&mobileCharacterStep=${step}`);
            } else {
                router.replace(`${returnUrl}${sep}mobileCharacterStatus=failed&mobileCharacterStep=${step}`);
            }
        } catch {
            setErrorMessage('Could not process wallet response. Redirecting...');
            const returnUrl = (router.query.returnUrl as string) || '/character/create';
            setTimeout(() => router.replace(returnUrl), 3000);
        }
    }, [router.isReady]);

    return (
        <Page title="Processing - SIGNArank">
            <div className="content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                {errorMessage ? <p>{errorMessage}</p> : <p>Processing wallet response...</p>}
            </div>
        </Page>
    );
};

export default CharacterSignedPage;
```

- [ ] **Step 2: Commit**

```bash
git add pages/wallet/character-signed.tsx
git commit -m "feat(character): add mobile wallet callback page for character signing"
```

---

## Task 9: Confirmation-progress polling hook

The wizard's "Creating..." step (Task 10) only covers getting both transactions *signed*. Per the spec's 4-state model (`docs/superpowers/specs/2026-07-25-character-presentation-design.md` Part 4), a contract funded in block N doesn't run `init()` until block N+1 — so "Live" specifically means the funding tx has reached **1 confirmation**, not just "broadcast successfully." This hook polls both transactions and derives that state.

**Files:**
- Create: `hooks/useCharacterCreationProgress.ts`

- [ ] **Step 1: Write the hook**

```ts
// hooks/useCharacterCreationProgress.ts
import { useState, useEffect, useRef } from 'react';
import { useSignumLedger } from '@hooks/useSignumLedger';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

export interface CreationProgress {
    /** Only ever 'pending' | 'deployed' | 'funding_settled' | 'live' here —
     * 'needs_funding' and 'failed' are handled before this hook is used. */
    state: PendingCharacterState;
    elapsedMs: number;
}

const POLL_INTERVAL_MS = 15 * 1000;

export const useCharacterCreationProgress = (tx1Id: string | null, tx2Id: string | null): CreationProgress => {
    const ledger = useSignumLedger();
    const [state, setState] = useState<PendingCharacterState>('pending');
    const [elapsedMs, setElapsedMs] = useState(0);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!tx1Id || !tx2Id || !ledger || state === 'live') return;

        let cancelled = false;

        const poll = async () => {
            try {
                const [tx1, tx2] = await Promise.all([
                    ledger.transaction.getTransaction(tx1Id),
                    ledger.transaction.getTransaction(tx2Id),
                ]);
                if (cancelled) return;

                // Absent `confirmations` means still in the mempool (never
                // included in a block yet); present means >= 0 confirmations.
                const tx1Confirmations = tx1.confirmations ?? -1;
                const tx2Confirmations = tx2.confirmations ?? -1;

                if (tx2Confirmations >= 1) {
                    setState('live');
                } else if (tx2Confirmations >= 0) {
                    setState('funding_settled');
                } else if (tx1Confirmations >= 0) {
                    setState('deployed');
                } else {
                    setState('pending');
                }
            } catch {
                // Transient node error (e.g. tx not yet relayed to this
                // node) — keep the previous state, try again next tick.
            }
        };

        void poll();
        const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
        const elapsedTimer = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);

        return () => {
            cancelled = true;
            clearInterval(pollTimer);
            clearInterval(elapsedTimer);
        };
    }, [tx1Id, tx2Id, ledger, state]);

    return { state, elapsedMs };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `hooks/useCharacterCreationProgress.ts`

- [ ] **Step 3: Commit**

```bash
git add hooks/useCharacterCreationProgress.ts
git commit -m "feat(character): add on-chain confirmation-progress polling for creation"
```

---

## Task 10: Wizard step components and page assembly

**Files:**
- Create: `components/Character/CreateWizard/NameDescriptionStep.tsx`
- Create: `components/Character/CreateWizard/AvatarStep.tsx`
- Create: `components/Character/CreateWizard/ReviewStep.tsx`
- Create: `components/Character/CreateWizard/CreatingStep.tsx`
- Create: `components/Character/CreateWizard/LiveStep.tsx`
- Create: `components/Character/CreateWizard/CharacterCreateWizard.tsx`
- Create: `pages/character/create.tsx`

- [ ] **Step 1: Name & Description step**

```tsx
// components/Character/CreateWizard/NameDescriptionStep.tsx
import React, { useState } from 'react';

const NAME_MAX_LENGTH = 24;

interface NameDescriptionStepProps {
    initialName: string;
    initialDescription: string;
    onNext: (name: string, description: string) => void;
}

export const NameDescriptionStep: React.FC<NameDescriptionStepProps> = ({ initialName, initialDescription, onNext }) => {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);

    const canContinue = name.trim().length > 0 && name.length <= NAME_MAX_LENGTH;

    return (
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
            />

            <button
                className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                disabled={!canContinue}
                onClick={() => onNext(name.trim(), description.trim())}
            >
                Next: Avatar
            </button>
        </div>
    );
};

export default NameDescriptionStep;
```

- [ ] **Step 2: Avatar step**

```tsx
// components/Character/CreateWizard/AvatarStep.tsx
import React, { useState, useCallback } from 'react';
import { checkImageConstraints, cropAndResizeToDataUrl } from '@lib/character/avatarImage';

export interface UploadedAvatar {
    ipfsCid: string;
    mimeType: string;
    url: string;
}

interface AvatarStepProps {
    onNext: (avatar: UploadedAvatar) => void;
    onBack: () => void;
}

export const AvatarStep: React.FC<AvatarStepProps> = ({ onNext, onBack }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adjustedNotice, setAdjustedNotice] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setAdjustedNotice(null);
        setUploading(true);
        try {
            const bitmap = await createImageBitmap(file);
            const { needsResize, needsCompress } = checkImageConstraints({
                width: bitmap.width,
                height: bitmap.height,
                sizeBytes: file.size,
            });
            // cropAndResizeToDataUrl always center-crops to square (avatars
            // render circular) regardless of these flags — they only drive
            // this user-facing notice about what else it also did.
            if (needsResize && needsCompress) {
                setAdjustedNotice('Image was resized and compressed to fit.');
            } else if (needsResize) {
                setAdjustedNotice('Image was resized to fit.');
            } else if (needsCompress) {
                setAdjustedNotice('Image was compressed to fit.');
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
            onNext(uploaded);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not process image');
            setPreviewUrl(null);
        } finally {
            setUploading(false);
        }
    }, [onNext]);

    return (
        <div className="glass-static overflow-hidden p-5">
            {previewUrl && (
                <img src={previewUrl} alt="Avatar preview" className="w-32 h-32 rounded-full object-cover mx-auto mb-4" />
            )}

            {adjustedNotice && (
                <p className="text-center text-[0.7rem] text-[var(--text-faint)] mb-3">{adjustedNotice}</p>
            )}

            {error && (
                <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                }}
                className="block w-full text-[0.8rem] text-[var(--text-dim)] mb-4"
            />

            {uploading && <p className="text-[0.8rem] text-[var(--text-dim)] text-center">Uploading...</p>}

            <button
                className="text-[0.75rem] underline text-[var(--text-dim)] bg-transparent border-none cursor-pointer"
                onClick={onBack}
                disabled={uploading}
            >
                Back
            </button>
        </div>
    );
};

export default AvatarStep;
```

- [ ] **Step 3: Review step**

```tsx
// components/Character/CreateWizard/ReviewStep.tsx
import React from 'react';
import { Amount } from '@signumjs/util';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';
import type { UploadedAvatar } from './AvatarStep';

interface ReviewStepProps {
    name: string;
    description: string;
    avatar: UploadedAvatar;
    signaBalance: number;
    onConfirm: () => void;
    onBack: () => void;
}

const NETWORK_FEE_ESTIMATE_SIGNA = 1.02; // deploy fee (1) + funding fee (0.02), matches useCharacterCreation/useCharacterFunding

export const ReviewStep: React.FC<ReviewStepProps> = ({ name, description, avatar, signaBalance, onConfirm, onBack }) => {
    const rechargeSigna = parseFloat(Amount.fromPlanck(CharacterCreationCostsPlanck).getSigna());
    const totalRequired = rechargeSigna + NETWORK_FEE_ESTIMATE_SIGNA;
    const insufficientFunds = totalRequired > signaBalance;

    return (
        <div className="glass-static overflow-hidden p-5">
            <img src={avatar.url} alt={name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
            <h3 className="text-center text-[var(--text)] mb-1">{name}</h3>
            <p className="text-center text-[0.8rem] text-[var(--text-dim)] mb-4">{description}</p>

            <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.75rem]" style={{ background: 'rgba(197,164,78,0.04)', border: '1px solid rgba(197,164,78,0.12)' }}>
                <p className="m-0">Character recharge: {rechargeSigna} SIGNA</p>
                <p className="m-0">Estimated network fees: {NETWORK_FEE_ESTIMATE_SIGNA} SIGNA</p>
                <p className="m-0 font-semibold">Total: {totalRequired.toFixed(2)} SIGNA</p>
            </div>

            {insufficientFunds && (
                <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    Insufficient balance. You have {signaBalance.toFixed(2)} SIGNA, need {totalRequired.toFixed(2)} SIGNA.
                </div>
            )}

            <button
                className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                style={{ background: 'linear-gradient(135deg, var(--ember), #c44a2a)' }}
                disabled={insufficientFunds}
                onClick={onConfirm}
            >
                Create Character
            </button>
            <button className="w-full text-[0.75rem] underline text-[var(--text-dim)] bg-transparent border-none cursor-pointer" onClick={onBack}>
                Back
            </button>
        </div>
    );
};

export default ReviewStep;
```

- [ ] **Step 4: Creating step (signing phase only)**

Covers getting both transactions signed — nothing on-chain to poll yet at this point. The separate `ConfirmingStep` (next step) takes over once both signatures exist.

```tsx
// components/Character/CreateWizard/CreatingStep.tsx
import React from 'react';
import type { CreationStep } from '@hooks/useCharacterCreation';

interface CreatingStepProps {
    creationStep: CreationStep;
    needsFundingAction: boolean;
    funding: boolean;
    onFund: () => void;
    error?: string;
}

const STEP_LABEL: Record<CreationStep, string> = {
    idle: 'Preparing...',
    'awaiting-deploy-signature': 'Step 1 of 2: Approve character deployment in your wallet',
    'awaiting-funding-signature': 'Step 2 of 2: Approve funding transaction in your wallet',
};

export const CreatingStep: React.FC<CreatingStepProps> = ({ creationStep, needsFundingAction, funding, onFund, error }) => {
    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            {error ? (
                <p className="text-[0.85rem]" style={{ color: '#ef4444' }}>{error}</p>
            ) : needsFundingAction ? (
                <>
                    <p className="text-[0.85rem] text-[var(--text)] mb-4">
                        Character deployed. Now fund it to bring it to life.
                    </p>
                    <button
                        className="py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                        disabled={funding}
                        onClick={onFund}
                    >
                        {funding ? 'Confirm in wallet...' : 'Continue: Fund Character'}
                    </button>
                </>
            ) : (
                <p className="text-[0.85rem] text-[var(--text)]">{STEP_LABEL[creationStep]}</p>
            )}
        </div>
    );
};

export default CreatingStep;
```

- [ ] **Step 5: Confirming step (4-state on-chain progress)**

```tsx
// components/Character/CreateWizard/ConfirmingStep.tsx
import React, { useEffect } from 'react';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { updatePendingCharacter, type PendingCharacterState } from '@lib/character/pendingCharacters';

interface ConfirmingStepProps {
    /** The wallet's connectedAccount (public key) — the same value used as
     * the pendingCharacters storage scope everywhere else in this wizard. */
    walletAccount: string;
    contractId: string;
    tx1Id: string;
    tx2Id: string;
    onLive: () => void;
}

const STATE_COPY: Record<PendingCharacterState, string> = {
    pending: 'Broadcasting both transactions...',
    deployed: 'Contract deployed on-chain. Waiting for funding to settle...',
    funding_settled: 'Funded. Waiting for the character to wake up...',
    live: 'Your character is alive!',
    needs_funding: 'Waiting for funding...',
    failed: 'Something went wrong.',
};

const WORST_CASE_MS = 8 * 60 * 1000;

export const ConfirmingStep: React.FC<ConfirmingStepProps> = ({ walletAccount, contractId, tx1Id, tx2Id, onLive }) => {
    const { state, elapsedMs } = useCharacterCreationProgress(tx1Id, tx2Id);

    useEffect(() => {
        updatePendingCharacter(walletAccount, contractId, { state });
    }, [walletAccount, contractId, state]);

    useEffect(() => {
        if (state === 'live') onLive();
    }, [state, onLive]);

    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            <p className="text-[0.9rem] text-[var(--text)] mb-2">{STATE_COPY[state]}</p>
            <p className="text-[0.7rem] text-[var(--text-faint)]">
                {elapsedMinutes}m {elapsedSeconds}s elapsed (typically ~4-8 min)
            </p>
            {elapsedMs > WORST_CASE_MS && (
                <p className="text-[0.7rem] mt-2" style={{ color: 'var(--ember)' }}>
                    This is taking longer than usual — the network may be congested. Your character is safe;
                    check back on its dashboard once you have the link.
                </p>
            )}
        </div>
    );
};

export default ConfirmingStep;
```

- [ ] **Step 6: Live step**

```tsx
// components/Character/CreateWizard/LiveStep.tsx
import React from 'react';
import { useRouter } from 'next/router';

interface LiveStepProps {
    contractId: string;
    name: string;
}

export const LiveStep: React.FC<LiveStepProps> = ({ contractId, name }) => {
    const router = useRouter();

    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            <p className="text-[0.9rem] text-[var(--text)] mb-4">
                {name} has been deployed. It will come to life once both transactions confirm (~4-8 minutes).
            </p>
            <button
                className="py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                onClick={() => router.push(`/character/${contractId}`)}
            >
                View Character
            </button>
        </div>
    );
};

export default LiveStep;
```

- [ ] **Step 7: Wizard orchestrator**

```tsx
// components/Character/CreateWizard/CharacterCreateWizard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Address } from '@signumjs/core';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useCharacterCreation } from '@hooks/useCharacterCreation';
import { useCharacterFunding } from '@hooks/useCharacterFunding';
import {
    upsertPendingCharacter,
    updatePendingCharacter,
    loadDraft,
    clearDraft,
    type PendingCharacter,
} from '@lib/character/pendingCharacters';
import NameDescriptionStep from './NameDescriptionStep';
import AvatarStep, { type UploadedAvatar } from './AvatarStep';
import ReviewStep from './ReviewStep';
import CreatingStep from './CreatingStep';
import ConfirmingStep from './ConfirmingStep';
import LiveStep from './LiveStep';

type WizardStep = 'name' | 'avatar' | 'review' | 'creating' | 'confirming' | 'live';

export const CharacterCreateWizard: React.FC = () => {
    const router = useRouter();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const accountId = React.useMemo(() => {
        if (!connectedAccount) return null;
        try {
            return Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            return null;
        }
    }, [connectedAccount]);

    const { balances } = useTokenBalances(accountId, []);
    const signaBalance = balances['0']?.amount ? Number(balances['0'].amount) : 0;

    const [step, setStep] = useState<WizardStep>('name');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatar, setAvatar] = useState<UploadedAvatar | null>(null);
    const [contractId, setContractId] = useState<string | null>(null);
    const [tx1Id, setTx1Id] = useState<string | null>(null);
    const [tx2Id, setTx2Id] = useState<string | null>(null);
    const [creationError, setCreationError] = useState<string | undefined>(undefined);
    const [needsFundingAction, setNeedsFundingAction] = useState(false);

    const { create, creating, creationStep } = useCharacterCreation();
    const { fund, funding } = useCharacterFunding();

    // Resume after a mobile wallet redirect (deploy or fund signing).
    useEffect(() => {
        if (!router.isReady || !connectedAccount) return;
        const { mobileCharacterStatus, mobileCharacterStep, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } = router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setCreationError('Signing was rejected or failed. Please try again.');
            setStep('review');
            cleanQuery();
            return;
        }

        if (mobileCharacterStep === 'deploy') {
            const draft = loadDraft(connectedAccount);
            const deployedContractId = mobileCharacterTxId as string;
            setContractId(deployedContractId);
            setTx1Id(deployedContractId);
            if (draft) {
                setName(draft.name);
                setDescription(draft.description);
                setAvatar({ ipfsCid: draft.avatarCid, mimeType: draft.avatarMime, url: draft.avatarUrl });
                upsertPendingCharacter(connectedAccount, {
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
            setNeedsFundingAction(true);
            setStep('creating');
        } else if (mobileCharacterStep === 'fund' && contractId) {
            const fundTxId = mobileCharacterTxId as string;
            updatePendingCharacter(connectedAccount, contractId, {
                tx2Id: fundTxId,
                state: 'deployed',
            });
            setTx2Id(fundTxId);
            setNeedsFundingAction(false);
            setStep('confirming');
        }

        cleanQuery();
    }, [router.isReady, connectedAccount]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleConfirmCreate = useCallback(async () => {
        if (!connectedAccount || !avatar) return;
        setStep('creating');
        setCreationError(undefined);

        const result = await create(
            { name, description },
            { name, description, avatarCid: avatar.ipfsCid, avatarMime: avatar.mimeType, avatarUrl: avatar.url },
        );

        if (!result.success) {
            if (result.cancelled) {
                setStep('review');
                return;
            }
            setCreationError(result.error || 'Character creation failed');
            return;
        }

        // create() only ever returns in-page on desktop/extension — mobile's
        // Signer.sign() navigates away and the resume effect above handles
        // that branch instead. So result.needsFunding is never true here;
        // desktop always uses the fully-chained (deploy + fund) call.
        if (!result.contractId) return;

        setContractId(result.contractId);
        setTx1Id(result.tx1Id || result.contractId);
        setTx2Id(result.tx2Id || null);

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
        upsertPendingCharacter(connectedAccount, entry);
        setStep('confirming');
    }, [connectedAccount, avatar, name, description, create]);

    const handleFund = useCallback(async () => {
        if (!connectedAccount || !contractId) return;
        const result = await fund(contractId);
        if (!result.success) {
            if (!result.cancelled) setCreationError(result.error || 'Funding failed');
            return;
        }
        updatePendingCharacter(connectedAccount, contractId, { tx2Id: result.txId, state: 'deployed' });
        setTx2Id(result.txId || null);
        setNeedsFundingAction(false);
        setStep('confirming');
    }, [connectedAccount, contractId, fund]);

    if (!connectedAccount) {
        return (
            <div className="glass-static overflow-hidden p-8 text-center">
                <p className="text-[var(--text-dim)] text-[0.9rem]">Connect your wallet to create a character.</p>
            </div>
        );
    }

    switch (step) {
        case 'name':
            return (
                <NameDescriptionStep
                    initialName={name}
                    initialDescription={description}
                    onNext={(n, d) => {
                        setName(n);
                        setDescription(d);
                        setStep('avatar');
                    }}
                />
            );
        case 'avatar':
            return (
                <AvatarStep
                    onNext={a => {
                        setAvatar(a);
                        setStep('review');
                    }}
                    onBack={() => setStep('name')}
                />
            );
        case 'review':
            return avatar ? (
                <ReviewStep
                    name={name}
                    description={description}
                    avatar={avatar}
                    signaBalance={signaBalance}
                    onConfirm={handleConfirmCreate}
                    onBack={() => setStep('avatar')}
                />
            ) : null;
        case 'creating':
            return (
                <CreatingStep
                    creationStep={creationStep}
                    needsFundingAction={needsFundingAction}
                    funding={funding}
                    onFund={handleFund}
                    error={creationError}
                />
            );
        case 'confirming':
            return contractId && tx1Id && tx2Id ? (
                <ConfirmingStep
                    walletAccount={connectedAccount}
                    contractId={contractId}
                    tx1Id={tx1Id}
                    tx2Id={tx2Id}
                    onLive={() => setStep('live')}
                />
            ) : null;
        case 'live':
            return contractId ? <LiveStep contractId={contractId} name={name} /> : null;
        default:
            return null;
    }
};

export default CharacterCreateWizard;
```

- [ ] **Step 8: Page shell**

```tsx
// pages/character/create.tsx
import Page from '@components/Page';
import CharacterCreateWizard from '@components/Character/CreateWizard/CharacterCreateWizard';

const CharacterCreatePage = () => (
    <Page title="Create Character - SIGNArank" description="Create your on-chain Character on SignaRank.">
        <div className="content max-w-lg mx-auto py-8 px-4">
            <CharacterCreateWizard />
        </div>
    </Page>
);

export default CharacterCreatePage;
```

- [ ] **Step 9: Type-check the whole feature**

Run: `npx tsc --noEmit`
Expected: no errors under `components/Character/`, `pages/character/`, `pages/wallet/character-signed.tsx`

Note: `useTokenBalances(accountId, [])` in `CharacterCreateWizard.tsx` reuses the existing hook from `hooks/useTokenBalances.ts` (already used by `AttackForm.tsx`) purely to read the SIGNA balance for the review step's insufficient-funds check — verify its signature accepts an empty token-id array before wiring this up; if it doesn't, read `balances['0']` a different way (e.g. a direct `ledger.account.getAccount()` call) rather than misusing that hook.

- [ ] **Step 10: Commit**

```bash
git add components/Character/CreateWizard pages/character/create.tsx
git commit -m "feat(character): add creation wizard steps and page"
```

---

## Task 11: Manual verification

This repo has no component/hook testing setup (confirmed: no `*.test.tsx` files exist for any existing component, including `AttackForm.tsx`/`ConstructPageBody.tsx`). Verify the wizard by running it against testnet.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Desktop/extension wallet walkthrough**

1. Open `http://localhost:3000/character/create`, connect a testnet extension wallet funded with test SIGNA.
2. Enter a name (test the 24-char cap) and description → Next.
3. Pick an image over 1024px in either dimension → confirm it's auto-cropped/resized to a square preview, then uploads without further action → advances to Review.
4. Confirm the cost breakdown shows 10 SIGNA recharge + fee estimate, and the total matches wallet balance minus what's expected afterward.
5. Click "Create Character" → confirm the extension prompts for exactly two signatures (deploy, then funding) with no intermediate button click needed.
6. Confirm it lands on the Confirming step, showing "Contract deployed on-chain. Waiting for funding to settle..." (or an earlier state, depending on timing) with an elapsed-time counter ticking up.
7. Watch it progress through `deployed` → `funding_settled` → `live` over roughly 2 blocks (~8 min worst case) — confirm the localStorage entry's `state` field updates in step with the on-screen copy (inspect `signarank:pendingCharacters:<accountId>` after each visible state change).
8. Once it reaches Live, confirm it auto-advances to the Live step showing "View Character" linking to `/character/<contractId>` (that page doesn't exist yet — 404 is expected until the Dashboard plan ships; just confirm the link target is correct).
9. Confirm the final localStorage entry has `state: "live"`, both `tx1Id` and `tx2Id` populated, and `tx1FullHash` populated.

- [ ] **Step 3: Mobile wallet walkthrough**

1. On a mobile device (or a browser with a mobile user-agent override, if the SIP22 wallet app supports that), repeat steps 2-4 above.
2. On "Create Character", confirm the mobile wallet app opens for the **deploy** signature only.
3. After approving, confirm the app returns to `/character/create` showing "Character deployed. Now fund it to bring it to life." with a "Continue: Fund Character" button — confirm no signature was silently requested a second time.
4. Confirm a `needs_funding` localStorage entry exists at this point (with `tx1Id` populated, `tx1FullHash` absent, `tx2Id` absent) — this proves the mid-flow recovery state works even if the user abandons here.
5. Tap "Continue: Fund Character" → confirm the mobile wallet reopens for the **funding** signature.
6. After approving, confirm it returns and lands on the Confirming step (not directly on Live), the localStorage entry now has `state: "deployed"` with `tx2Id` populated, and it progresses to Live the same way as the desktop walkthrough (step 7-9 above).

- [ ] **Step 4: Error paths**

1. Start creation, reject the deploy signature in the wallet → confirm the wizard returns to the Review step with no localStorage entry written (nothing happened on-chain).
2. On desktop, reject the *second* (funding) signature after approving the first → confirm the flow surfaces a clear error rather than silently hanging (the on-chain deploy already happened in this case — note in your verification notes whether the current implementation correctly reflects that the contract exists but is unfunded, since desktop's chained call doesn't get a chance to record `tx1Id` if `createContract` throws before returning; if it silently loses that state, file a follow-up — recovering an orphaned desktop deploy is out of scope for this plan but shouldn't be invisible).
