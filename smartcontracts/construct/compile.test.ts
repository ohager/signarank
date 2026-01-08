import {describe, expect, test} from "vitest";
import {readFileSync} from "fs"
import {Context} from "./context";
import {SmartC} from "smartc-signum-compiler";

const MAX_CODE_SIZE = 40 * 256; // 10240

describe("Compile Test", () => {

    test('should be within maximum code limit', () => {
        const code = readFileSync(Context.ContractPath, 'utf8')
        const compiler = new SmartC({
            language: "C",
            sourceCode: code,
        });
        const compiled = compiler.compile();
        const machinedata = compiled.getMachineCode();
        const codeSize = machinedata.ByteCode.length / 2;
        expect(machinedata).toBeDefined()
        expect(codeSize).toBeLessThanOrEqual(MAX_CODE_SIZE)
    })

})
