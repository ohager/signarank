import {describe, expect, test} from "vitest";
import {attack, deployConstruct, deployConstructWithCharacter, setCharacterDamage, timeLapse} from "../lib";
import {Context} from "../context";

// Step 4: reward routing. For a CHARACTER attacker the hpToken damage-share
// receipt and all SIGNA bonuses/pool go to the OWNER (getCreatorOf), while the
// xpToken stays on the character (it levels on its own XP balance). EOAs are
// unchanged. firstBloodAccount/finalBlowAccount store the owner for characters,
// so distributeToHolders works unchanged (the owner holds the hpToken).

function hpTokenId(testbed: any): bigint {
    return testbed.getContractMemoryValue('hpTokenId', Context.ThisContract);
}
function heldToken(testbed: any, holder: bigint, asset: bigint, isContract: boolean): bigint {
    const acct = isContract ? testbed.getContract(holder) : testbed.getAccount(holder);
    return acct?.tokens.find((t: any) => t.asset === asset)?.quantity ?? 0n;
}

describe("Reward Routing", () => {
    test("routes the hpToken damage share to the owner for a character attacker", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n); // base damage 10 for 100 SIGNA

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(heldToken(testbed, characterOwner, hpTokenId(testbed), false)).toBe(10n);
        // the character itself must NOT hold the hpToken (it would reject it)
        expect(heldToken(testbed, characterAddress, hpTokenId(testbed), true)).toBe(0n);
    });

    test("routes the xpToken to the character itself", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(heldToken(testbed, characterAddress, Context.XPTokenId, true)).toBe(10n);
        // the owner does NOT receive XP
        expect(heldToken(testbed, characterOwner, Context.XPTokenId, false)).toBe(0n);
    });

    test("leaves EOA reward routing unchanged (both tokens to the sender)", () => {
        const testbed = deployConstruct();

        attack({testbed, signa: 100n, sender: Context.SenderAccount1});

        expect(heldToken(testbed, Context.SenderAccount1, hpTokenId(testbed), false)).toBe(10n);
        expect(heldToken(testbed, Context.SenderAccount1, Context.XPTokenId, false)).toBe(10n);
    });

    test("routes a character's final-blow bonus to the owner (EOA first blood unchanged)", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter({
            maxHp: 100n,
            breachLimit: 100n,
            firstBloodBonus: 50_0000_0000n,
            finalBlowBonus: 100_0000_0000n,
        });
        setCharacterDamage(testbed, 0n, 0n);

        // EOA lands first blood (55 dmg), the character lands the final blow (52 →
        // capped to the remaining 45). Distinct accounts avoid send coalescing.
        attack({testbed, signa: 550n, sender: Context.SenderAccount1});
        timeLapse({testbed, blocks: 2n});
        attack({testbed, sender: characterAddress, signa: 520n});

        expect(testbed.getContractMemoryValue('isDefeated', Context.ThisContract)).toBe(1n);
        // first blood: the EOA is stored as-is
        expect(testbed.getContractMemoryValue('firstBloodAccount', Context.ThisContract)).toBe(Context.SenderAccount1);
        // final blow: the character's OWNER is stored
        expect(testbed.getContractMemoryValue('finalBlowAccount', Context.ThisContract)).toBe(characterOwner);

        const txs = testbed.getTransactions();
        expect(txs.some(tx => tx.recipient === characterOwner && tx.amount === 100_0000_0000n)).toBeTruthy();      // final blow → owner
        expect(txs.some(tx => tx.recipient === Context.SenderAccount1 && tx.amount === 50_0000_0000n)).toBeTruthy(); // first blood → EOA
        // XP for the defeating hit still goes to the character
        expect(heldToken(testbed, characterAddress, Context.XPTokenId, true)).toBe(45n);
    });
});
