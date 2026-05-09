import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/character-account-registry.contract.smart.c'),
    CreatorAccount:    555n,
    GamemasterAccount: 555n,
    ThisContract:      999n,

    Methods: {
        SetCharacterHash:  1n,
        RegisterCharacter: 2n,
    },

    // (0, 0) -> trusted character codehash configured by the gamemaster.
    Globals: {
        TrustedHashK1: 0n,
        TrustedHashK2: 0n,
    },
} as const;
