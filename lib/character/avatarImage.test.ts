import { describe, it, expect } from 'vitest';
import { checkImageConstraints } from './avatarImage';

describe('checkImageConstraints', () => {
    it('flags nothing for an image already within bounds', () => {
        const result = checkImageConstraints({ width: 512, height: 512, sizeBytes: 500_000 });
        expect(result).toEqual({ needsResize: false, needsCompress: false });
    });

    it('flags resize when either dimension exceeds the 1024px cap', () => {
        expect(checkImageConstraints({ width: 2000, height: 512, sizeBytes: 500_000 })).toEqual({
            needsResize: true,
            needsCompress: false,
        });
        expect(checkImageConstraints({ width: 512, height: 2000, sizeBytes: 500_000 })).toEqual({
            needsResize: true,
            needsCompress: false,
        });
    });

    it('flags compress when size exceeds the 2MiB cap', () => {
        const result = checkImageConstraints({ width: 512, height: 512, sizeBytes: 3 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: false, needsCompress: true });
    });

    it('flags both when both bounds are exceeded', () => {
        const result = checkImageConstraints({ width: 4000, height: 4000, sizeBytes: 5 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: true, needsCompress: true });
    });

    it('treats exactly-at-the-cap dimensions and size as within bounds', () => {
        const result = checkImageConstraints({ width: 1024, height: 1024, sizeBytes: 2 * 1024 * 1024 });
        expect(result).toEqual({ needsResize: false, needsCompress: false });
    });
});
