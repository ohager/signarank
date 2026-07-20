import {describe, expect, test} from "vitest";
import {attack, deployConstruct, deployConstructWithCharacter, getCurrentHitpoints} from "../lib";
import {Context} from "../context";

// Step 2 of the construct-combat rollout: the gamemaster-set attacker mode gate.
// A rejected attacker (wrong type for the mode) is REFUNDED, not burned — the
// same graceful path as the "not ready yet" refund. The gate sits right after
// character detection, before the attacker round runs.
//
// "accepted" here just means the normal attacker round runs (HP drops). The
// character-specific damage/reward branches are later steps; step 2 only gates
// who is allowed through.

function setAttackerMode(mode: bigint) {
    return {
        sender: Context.CreatorAccount,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetAttackerMode, mode, 0n, 0n],
    };
}

describe("Attacker Mode Gate", () => {
    describe("ATTACKER_MODE_ANY (default)", () => {
        test("accepts an EOA attacker", () => {
            const testbed = deployConstruct();
            const before = getCurrentHitpoints(testbed)!;
            attack({testbed, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });

        test("accepts a character attacker", () => {
            const {testbed, characterAddress} = deployConstructWithCharacter();
            const before = getCurrentHitpoints(testbed)!;
            attack({testbed, sender: characterAddress, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });
    });

    describe("ATTACKER_MODE_CHARACTER_ONLY", () => {
        test("rejects an EOA attacker and refunds the full SIGNA", () => {
            const {testbed} = deployConstructWithCharacter({}, {
                extraTxs: [setAttackerMode(Context.AttackerMode.CharacterOnly)],
            });
            const before = getCurrentHitpoints(testbed)!;

            attack({testbed, sender: Context.SenderAccount1, signa: 100n});

            // HP untouched — the attack never landed
            expect(getCurrentHitpoints(testbed)).toBe(before);
            // full SIGNA refunded to the rejected EOA (not burned)
            const refund = testbed.getTransactions().slice(-1)[0];
            expect(refund.recipient).toBe(Context.SenderAccount1);
            expect(refund.amount).toBe(100_0000_0000n);
        });

        test("accepts a character attacker", () => {
            const {testbed, characterAddress} = deployConstructWithCharacter({}, {
                extraTxs: [setAttackerMode(Context.AttackerMode.CharacterOnly)],
            });
            const before = getCurrentHitpoints(testbed)!;
            attack({testbed, sender: characterAddress, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });
    });

    describe("ATTACKER_MODE_EOA_ONLY", () => {
        test("rejects a character attacker and refunds the full SIGNA", () => {
            const {testbed, characterAddress} = deployConstructWithCharacter({}, {
                extraTxs: [setAttackerMode(Context.AttackerMode.EoaOnly)],
            });
            const before = getCurrentHitpoints(testbed)!;

            attack({testbed, sender: characterAddress, signa: 100n});

            expect(getCurrentHitpoints(testbed)).toBe(before);
            const refund = testbed.getTransactions().slice(-1)[0];
            expect(refund.recipient).toBe(characterAddress);
            expect(refund.amount).toBe(100_0000_0000n);
        });

        test("accepts an EOA attacker", () => {
            const {testbed} = deployConstructWithCharacter({}, {
                extraTxs: [setAttackerMode(Context.AttackerMode.EoaOnly)],
            });
            const before = getCurrentHitpoints(testbed)!;
            attack({testbed, sender: Context.SenderAccount1, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });
    });

    describe("SETATTACKERMODE guards", () => {
        test("only the creator can change the mode", () => {
            // Locked to EOAs, then a non-creator (SenderAccount2) tries to flip
            // it to CHARACTER_ONLY. If that succeeded, the later EOA attack would
            // be rejected — so an EOA landing damage proves the mode never changed.
            const {testbed} = deployConstructWithCharacter({}, {
                extraTxs: [
                    setAttackerMode(Context.AttackerMode.EoaOnly),
                    {
                        sender: Context.SenderAccount2,
                        amount: Context.ActivationFee,
                        messageArr: [Context.Methods.SetAttackerMode, Context.AttackerMode.CharacterOnly, 0n, 0n],
                    },
                ],
            });
            const before = getCurrentHitpoints(testbed)!;

            // still EOA_ONLY → a fresh EOA attacker is accepted and lands damage
            attack({testbed, sender: Context.SenderAccount1, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });

        test("ignores an out-of-range mode value", () => {
            const {testbed} = deployConstructWithCharacter({}, {
                extraTxs: [setAttackerMode(99n)],
            });
            const before = getCurrentHitpoints(testbed)!;
            // invalid value ignored → mode stays ANY → EOA still accepted
            attack({testbed, sender: Context.SenderAccount1, signa: 100n});
            expect(getCurrentHitpoints(testbed)).toBeLessThan(before);
        });
    });
});
