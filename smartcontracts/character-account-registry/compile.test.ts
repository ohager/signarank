import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { Context } from './context';
import { SmartC } from 'smartc-signum-compiler';

const MAX_CODE_SIZE = 40 * 256;

describe('Character-Account Registry Compile Test', () => {
    test('should compile and be within code size limit', () => {
        const code = readFileSync(Context.ContractPath, 'utf8');
        const compiler = new SmartC({ language: 'C', sourceCode: code });
        const compiled = compiler.compile();
        const machinedata = compiled.getMachineCode();
        expect(machinedata).toBeDefined();
        expect(machinedata.ByteCode.length / 2).toBeLessThanOrEqual(MAX_CODE_SIZE);
    });
});
