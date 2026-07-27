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
