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
