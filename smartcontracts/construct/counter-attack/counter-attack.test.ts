import {describe, expect, test} from "vitest";
import {asHexMessage} from "signum-smartc-testbed";
import {attack, deployConstructWithCharacter, setCounterDamage, setCounterEffect, setDebuff} from "../lib";
import {Context} from "../context";

// Step 6 / status pass 3: counter-attack. The shared chance model (debuff.chance,
// breach-severity scaled) decides IF a counter fires; the EFFECT branches by target:
//   - character → send COMBAT(counterDamage, counterEffectId, duration) with the
//     character's activation fee (the character mitigates and may die).
//   - EOA → the existing debuff-stack counter (unchanged).
// counterEffectId 0 = pure damage (== the character's DEDUCT_HITPOINTS).
//
// Deterministic fire: within the breach limit the chance is the raw debuff.chance
// (no 90% cap), so chance 100 + a small hit always fires.

const RECEIVE_ATTACK = Context.CharReceiveAttack;

// Exact COMBAT(damage, effectId, duration) message to the character.
function combatTo(testbed: any, recipient: bigint, damage: bigint, effectId = 0n, duration = 0n) {
    const hex = asHexMessage([RECEIVE_ATTACK, damage, effectId, duration]);
    return testbed.getTransactions().filter((tx: any) => tx.recipient === recipient && tx.messageHex === hex);
}
// Any COMBAT message to the recipient (matches the method regardless of args).
function anyCombatTo(testbed: any, recipient: bigint) {
    const prefix = asHexMessage([RECEIVE_ATTACK]); // first long identifies the method
    return testbed.getTransactions().filter((tx: any) => tx.recipient === recipient && tx.messageHex?.startsWith(prefix));
}

describe("Counter Attack", () => {
    test("sends R (with the activation fee) to a countered character", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 0n, 0n);   // 100% counter chance
        setCounterDamage(testbed, 500n);

        attack({testbed, sender: characterAddress, signa: 100n}); // within breach → base counter

        // no counter effect configured → COMBAT(500, 0, 0) = pure damage
        const counters = combatTo(testbed, characterAddress, 500n);
        expect(counters.length).toBeGreaterThan(0);
        expect(counters[0].amount).toBeGreaterThan(0n); // activation fee attached so the msg is picked up
    });

    test("counter damage equals the base within the breach limit", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 0n, 0n);
        setCounterDamage(testbed, 250n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(combatTo(testbed, characterAddress, 250n).length).toBeGreaterThan(0);
    });

    test("bundles the configured counter effect + duration into the COMBAT hit", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 0n, 0n);
        setCounterDamage(testbed, 500n);
        setCounterEffect(testbed, 700_101n, 25n); // effectId + 25-block duration

        attack({testbed, sender: characterAddress, signa: 100n});

        // COMBAT(500, 700101, 25)
        expect(combatTo(testbed, characterAddress, 500n, 700_101n, 25n).length).toBeGreaterThan(0);
    });

    test("an EOA gets the debuff-stack counter, not a COMBAT", () => {
        const {testbed} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 20n, 3n); // damageReduction 20 → EOA debuff active
        setCounterDamage(testbed, 500n);

        attack({testbed, sender: Context.SenderAccount1, signa: 100n});

        expect(anyCombatTo(testbed, Context.SenderAccount1).length).toBe(0);
        expect(testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1, Context.ThisContract)).toBe(1n);
    });

    test("no counter is sent to a character when no counter damage is configured", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 0n, 0n); // fires, but counterDamageBase is 0
        // no SETCOUNTERDAMAGE

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(anyCombatTo(testbed, characterAddress).length).toBe(0);
    });

    test("only the creator can set the counter damage", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDebuff(testbed, 100n, 0n, 0n);
        // non-creator attempt is treated as an attack, not config
        testbed.sendTransactionAndGetResponse([{
            sender: Context.SenderAccount1,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetCounterDamage, 500n, 0n, 0n],
        }], Context.ThisContract);

        attack({testbed, sender: characterAddress, signa: 100n});

        // base still 0 → no counter
        expect(anyCombatTo(testbed, characterAddress).length).toBe(0);
    });
});
