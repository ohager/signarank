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
