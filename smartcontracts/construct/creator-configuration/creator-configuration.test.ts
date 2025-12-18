import {describe, expect, test} from "vitest";

import {SimulatorTestbed} from "signum-smartc-testbed";
import {Context} from "../context";
import {CreatorConfiguration} from "./creator-configuration.scenarios";


describe('Construct Contract - Creator Configuration', () => {
    test('should return tokens as expected', () => {
        const testbed = new SimulatorTestbed(CreatorConfiguration)
            .loadContract(Context.ContractPath)
            .runScenario();

        expect(testbed.getContractMemoryValue('firstBloodBonus')).toBe(1000_0000_0000n)
        expect(testbed.getContractMemoryValue('finalBlowBonus')).toBe(5000_0000_0000n)
    })
})
