import { describe, expect, test } from 'vitest';
import { join } from 'path';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import {
    BootstrapScenario,
    setCharacterHash,
    registerCharacter,
    unregisterCharacter,
    getValue,
} from './lib';

const CHARACTER_CONTRACT_PATH = join(__dirname, '..', 'character', 'character.contract.smart.c');

function makeTestbed() {
    return new SimulatorTestbed(BootstrapScenario)
        .loadContract(Context.ContractPath)
        .runScenario();
}

function makeTestbedWithCharacter(opts: { creator?: bigint; address?: bigint } = {}) {
    const creator = opts.creator ?? 4242n;
    const address = opts.address ?? 7777n;
    const testbed = new SimulatorTestbed(BootstrapScenario)
        .loadContract(CHARACTER_CONTRACT_PATH, { creator, contractId: address })
        .loadContract(Context.ContractPath);
    const character = testbed.getContract(address);
    testbed.runScenario();
    return { testbed, character };
}

// k2 = 0 is the reserved per-creator character counter, not a character entry.
function indexEntries(testbed: SimulatorTestbed, accountId: bigint) {
    return testbed.getContractMap().filter(({ k1, k2 }) => k1 === accountId && k2 !== 0n);
}

function counterOf(testbed: SimulatorTestbed, accountId: bigint): bigint {
    return getValue(testbed, accountId, 0n);
}

// Mirrors MAX_CHARACTERS_PER_ACCOUNT in the contract source.
const MAX_CHARACTERS_PER_ACCOUNT = 5;

describe('Trusted character hash configuration', () => {
    test('gamemaster (creator) can set the trusted character hash', () => {
        const testbed = makeTestbed();
        const HASH = 0xAABB_CCDD_EEFFn;

        setCharacterHash(testbed, HASH);

        expect(getValue(testbed, Context.Globals.TrustedHashK1, Context.Globals.TrustedHashK2)).toBe(HASH);
    });

    test('non-creator cannot set the trusted character hash', () => {
        const testbed = makeTestbed();

        testbed.sendTransactionAndGetResponse([{
            sender:    99999n,
            recipient: Context.ThisContract,
            amount:    1_0000_0000n,
            messageArr: [Context.Methods.SetCharacterHash, 0x1234_5678n, 0n, 0n],
        }]);

        expect(getValue(testbed, Context.Globals.TrustedHashK1, Context.Globals.TrustedHashK2)).toBe(0n);
    });
});

describe('Character registration', () => {
    test('character with matching codehash is recorded under (creator, characterId) -> codehash', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);

        registerCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
    });

    test('does not register when sender codehash does not match the trusted hash', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId + 1n);

        registerCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(0n);
    });

    test('does not register when trusted hash has not been configured', () => {
        // Leave trusted hash unset (still 0). An EOA's codehash is also 0, but we
        // still expect the contract to refuse — the explicit guard prevents the
        // 0 == 0 footgun from auto-trusting any unauthenticated sender.
        const { testbed, character } = makeTestbedWithCharacter();

        registerCharacter(testbed, character.contract);

        expect(indexEntries(testbed, character.creator)).toHaveLength(0);
    });

    test('does not register when sender is an EOA (codehash 0) even if trusted hash is non-zero', () => {
        const { testbed } = makeTestbedWithCharacter();
        setCharacterHash(testbed, 0xDEAD_BEEFn);

        const EOA_SENDER = 88888n;
        testbed.sendTransactionAndGetResponse([{
            sender:    EOA_SENDER,
            recipient: Context.ThisContract,
            amount:    1_0000_0000n,
            messageArr: [Context.Methods.RegisterCharacter, 0n, 0n, 0n],
        }]);

        // EOAs have getCreatorOf == 0; check the specific (0, EOA_SENDER) cell
        // is empty (the trusted-hash slot at (0, 0) is unrelated).
        expect(getValue(testbed, 0n, EOA_SENDER)).toBe(0n);
    });

    test('gamemaster (creator) cannot use REGISTER_CHARACTER', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);

        testbed.sendTransactionAndGetResponse([{
            sender:    Context.GamemasterAccount,
            recipient: Context.ThisContract,
            amount:    1_0000_0000n,
            messageArr: [Context.Methods.RegisterCharacter, 0n, 0n, 0n],
        }]);

        expect(indexEntries(testbed, Context.GamemasterAccount)).toHaveLength(0);
    });

    test('re-registering the same character is idempotent', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);

        registerCharacter(testbed, character.contract);
        registerCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(indexEntries(testbed, character.creator)).toHaveLength(1);
    });
});

describe('Character unregistration', () => {
    test('unregistering a registered character clears its index entry', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);
        registerCharacter(testbed, character.contract);

        unregisterCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(0n);
    });

    test('unregistering decrements the per-creator counter', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);
        registerCharacter(testbed, character.contract);
        expect(counterOf(testbed, character.creator)).toBe(1n);

        unregisterCharacter(testbed, character.contract);

        expect(counterOf(testbed, character.creator)).toBe(0n);
    });

    test('unregistering a character that was never registered is a no-op', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);

        unregisterCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(0n);
        expect(counterOf(testbed, character.creator)).toBe(0n);
    });

    test('unregistering twice does not drive the counter negative', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);
        registerCharacter(testbed, character.contract);

        unregisterCharacter(testbed, character.contract);
        unregisterCharacter(testbed, character.contract);

        expect(counterOf(testbed, character.creator)).toBe(0n);
    });

    test('gamemaster (creator) cannot use UNREGISTER_CHARACTER', () => {
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);
        registerCharacter(testbed, character.contract);

        testbed.sendTransactionAndGetResponse([{
            sender:    Context.GamemasterAccount,
            recipient: Context.ThisContract,
            amount:    1_0000_0000n,
            messageArr: [Context.Methods.UnregisterCharacter, 0n, 0n, 0n],
        }]);

        expect(getValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(counterOf(testbed, character.creator)).toBe(1n);
    });

    test('a sender no longer matching the trusted codehash cannot unregister', () => {
        // Registered while trusted, then the gamemaster rotates the trusted
        // hash. isSenderCharacter() now rejects the sender, so unregister must
        // be refused just like register would be — the trust check gates both.
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);
        registerCharacter(testbed, character.contract);

        setCharacterHash(testbed, character.codeHashId + 1n);
        unregisterCharacter(testbed, character.contract);

        expect(getValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(counterOf(testbed, character.creator)).toBe(1n);
    });

    test('unregistering one character does not affect siblings of the same account', () => {
        const PLAYER = 9999n;
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5001n })
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5002n })
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5003n })
            .loadContract(Context.ContractPath);
        const charA = testbed.getContract(5001n);
        const charB = testbed.getContract(5002n);
        const charC = testbed.getContract(5003n);
        testbed.runScenario();
        setCharacterHash(testbed, charA.codeHashId);
        registerCharacter(testbed, charA.contract);
        registerCharacter(testbed, charB.contract);
        registerCharacter(testbed, charC.contract);

        unregisterCharacter(testbed, charB.contract);

        expect(getValue(testbed, PLAYER, charA.contract)).toBe(charA.codeHashId);
        expect(getValue(testbed, PLAYER, charB.contract)).toBe(0n);
        expect(getValue(testbed, PLAYER, charC.contract)).toBe(charC.codeHashId);
        expect(counterOf(testbed, PLAYER)).toBe(2n);
    });

    test('unregistering frees a slot once an account is at MAX_CHARACTERS_PER_ACCOUNT', () => {
        const PLAYER = 8888n;
        const contractIds = Array.from({ length: MAX_CHARACTERS_PER_ACCOUNT + 1 }, (_, i) => 6001n + BigInt(i));
        let testbed = new SimulatorTestbed(BootstrapScenario);
        for (const contractId of contractIds) {
            testbed = testbed.loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId });
        }
        testbed = testbed.loadContract(Context.ContractPath);
        const characters = contractIds.map(id => testbed.getContract(id));
        testbed.runScenario();
        setCharacterHash(testbed, characters[0].codeHashId);

        // Fill all MAX_CHARACTERS_PER_ACCOUNT slots.
        for (let i = 0; i < MAX_CHARACTERS_PER_ACCOUNT; i++) {
            registerCharacter(testbed, characters[i].contract);
        }
        expect(counterOf(testbed, PLAYER)).toBe(BigInt(MAX_CHARACTERS_PER_ACCOUNT));

        // The extra character is rejected — the account is at capacity.
        const overflow = characters[MAX_CHARACTERS_PER_ACCOUNT];
        registerCharacter(testbed, overflow.contract);
        expect(getValue(testbed, PLAYER, overflow.contract)).toBe(0n);

        // Freeing a slot lets the overflow character register.
        unregisterCharacter(testbed, characters[0].contract);
        registerCharacter(testbed, overflow.contract);

        expect(getValue(testbed, PLAYER, overflow.contract)).toBe(overflow.codeHashId);
        expect(counterOf(testbed, PLAYER)).toBe(BigInt(MAX_CHARACTERS_PER_ACCOUNT));
    });
});

describe('Listing characters of an account', () => {
    test('all characters of one account are individually addressable via (account, *) entries', () => {
        const PLAYER = 9999n;
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5001n })
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5002n })
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: PLAYER, contractId: 5003n })
            .loadContract(Context.ContractPath)
        const charA = testbed.getContract(5001n);
        const charB = testbed.getContract(5002n);
        const charC = testbed.getContract(5003n);
        testbed.runScenario();

        // All three are compiled from the same source -> identical codehash.
        setCharacterHash(testbed, charA.codeHashId);

        registerCharacter(testbed, charA.contract);
        registerCharacter(testbed, charB.contract);
        registerCharacter(testbed, charC.contract);

        const entries = indexEntries(testbed, PLAYER);
        expect(entries).toHaveLength(3);
        const characterIds = entries.map(e => e.k2).sort();
        expect(characterIds).toEqual([5001n, 5002n, 5003n].sort());
        // Every entry carries the codehash as version tag.
        for (const e of entries) {
            expect(e.value).toBe(charA.codeHashId);
        }
    });

    test('different accounts each have their own list', () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: 1001n, contractId: 7001n })
            .loadContract(CHARACTER_CONTRACT_PATH, { creator: 2002n, contractId: 7002n })
            .loadContract(Context.ContractPath);
        const charA = testbed.getContract(7001n);
        const charB = testbed.getContract(7002n);
        testbed.runScenario();

        setCharacterHash(testbed, charA.codeHashId);

        registerCharacter(testbed, charA.contract);
        registerCharacter(testbed, charB.contract);

        expect(indexEntries(testbed, 1001n).map(e => e.k2)).toEqual([7001n]);
        expect(indexEntries(testbed, 2002n).map(e => e.k2)).toEqual([7002n]);
    });

    test('value carries the codehash so readers can distinguish character versions', () => {
        // We can't easily forge a "v2" codehash inside the simulator, but the
        // previous tests confirm the value equals the registrant's codehash.
        // This test pins the contract: a stored entry's value MUST be a
        // non-zero codehash, never a sentinel like 1.
        const { testbed, character } = makeTestbedWithCharacter();
        setCharacterHash(testbed, character.codeHashId);

        registerCharacter(testbed, character.contract);

        const stored = getValue(testbed, character.creator, character.contract);
        expect(stored).toBe(character.codeHashId);
        expect(stored).not.toBe(1n);
        expect(stored).toBeGreaterThan(0n);
    });
});
