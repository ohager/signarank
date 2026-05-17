import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';

// Compose the physical k1 for an effect from a logical id (small number).
// The Gamemaster's off-chain encoder must apply the same offset before sending.
export const effectK1 = (logical: bigint): bigint => Context.RegistryBase + logical;

export type ItemDefinition = {
    tokenId: bigint;
    itemType: bigint;
    stackLimit: bigint;
    minLevel: bigint;
    effectCount: bigint;
};

export type EffectDefinition = {
    effectId: bigint;
    target: bigint;
    mode: bigint;
    bonusAbs: bigint;
    bonusRel: bigint;
    duration: bigint;
};

// REGISTER_ITEM packing:
//   m[2] = type(8) | stackLimit(8) | minLevel(8)
//   m[3] = effectCount(8)
export function packRegisterItem(def: ItemDefinition): [bigint, bigint, bigint, bigint] {
    const packed1 =
        (def.itemType    & 0xFFn) |
        ((def.stackLimit & 0xFFn) << 8n) |
        ((def.minLevel   & 0xFFn) << 16n);
    const packed2 = def.effectCount & 0xFFn;
    return [Context.Methods.RegisterItem, def.tokenId, packed1, packed2];
}

// REGISTER_EFFECT packing:
//   m[2] = target(8) | mode(8)
//   m[3] = bonusAbs(16) | bonusRel(16) | duration(32)
export function packRegisterEffect(def: EffectDefinition): [bigint, bigint, bigint, bigint] {
    const packed1 =
        (def.target & 0xFFn) |
        ((def.mode  & 0xFFn) << 8n);
    const packed2 =
        (def.bonusAbs  & 0xFFFFn) |
        ((def.bonusRel & 0xFFFFn) << 16n) |
        ((def.duration & 0xFFFFFFFFn) << 32n);
    return [Context.Methods.RegisterEffect, def.effectId, packed1, packed2];
}

function asGamemaster(testbed: SimulatorTestbed, messageArr: bigint[]) {
    return testbed.sendTransactionAndGetResponse([{
        sender:    Context.GamemasterAccount,
        recipient: Context.ThisContract,
        amount:    1_0000_0000n,
        messageArr,
    }]);
}

export function setConstructHash(testbed: SimulatorTestbed, hash: bigint) {
    return asGamemaster(testbed, [Context.Methods.SetConstructHash, hash, 0n, 0n]);
}

export function setCharacterHash(testbed: SimulatorTestbed, hash: bigint) {
    return asGamemaster(testbed, [Context.Methods.SetCharacterHash, hash, 0n, 0n]);
}

export function setLevelThreshold(testbed: SimulatorTestbed, level: bigint, xp: bigint) {
    return asGamemaster(testbed, [Context.Methods.SetLevelThreshold, level, xp, 0n]);
}

export function registerItem(testbed: SimulatorTestbed, def: ItemDefinition) {
    return asGamemaster(testbed, packRegisterItem(def));
}

export function unregisterItem(testbed: SimulatorTestbed, tokenId: bigint) {
    return asGamemaster(testbed, [Context.Methods.UnregisterItem, tokenId, 0n, 0n]);
}

export function setItemEffect(testbed: SimulatorTestbed, tokenId: bigint, slot: bigint, effectId: bigint) {
    return asGamemaster(testbed, [Context.Methods.SetItemEffect, tokenId, slot, effectId]);
}

export function registerEffect(testbed: SimulatorTestbed, def: EffectDefinition) {
    return asGamemaster(testbed, packRegisterEffect(def));
}

export function unregisterEffect(testbed: SimulatorTestbed, effectId: bigint) {
    return asGamemaster(testbed, [Context.Methods.UnregisterEffect, effectId, 0n, 0n]);
}

export function getValue(testbed: SimulatorTestbed, k1: bigint, k2: bigint): bigint {
    return testbed.getContractMapValue(k1, k2);
}

// All rejected creator txs are logged at (G_ERROR_LOG, txId) = errorCode.
// This returns just the codes — sufficient for most test assertions.
export function getErrorCodes(testbed: SimulatorTestbed): bigint[] {
    return testbed.getContractMapValues(Context.Globals.ErrorLog).map(m => m.value);
}

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
    }
];
