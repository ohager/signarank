import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadFileMock = vi.fn();
const s3SendMock = vi.fn();

vi.mock('pinata', () => ({
    PinataSDK: vi.fn().mockImplementation(function () {
        return { upload: { public: { file: uploadFileMock } } };
    }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(function () {
        return { send: s3SendMock };
    }),
    PutObjectCommand: vi.fn().mockImplementation(function (input: unknown) {
        return { input };
    }),
}));

import { createCharacterMediaUploadService } from './mediaUpload.server';

const CONFIG = {
    pinata: { jwt: 'test-jwt', gateway: 'gateway.test' },
    r2: {
        accountId: 'acct',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucketName: 'bucket',
        publicUrl: 'https://r2.signarank.club',
    },
};

describe('createCharacterMediaUploadService', () => {
    beforeEach(() => {
        uploadFileMock.mockReset();
        s3SendMock.mockReset();
    });

    it('uploads a data URL to Pinata then R2, returning ipfsCid/mimeType/url', async () => {
        uploadFileMock.mockResolvedValue({ cid: 'bafy123' });
        s3SendMock.mockResolvedValue({});

        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/jpeg;base64,${Buffer.from('fake-image-bytes').toString('base64')}`;
        const result = await service.uploadFromDataUrl(dataUrl, 'avatar.jpg');

        expect(result).toEqual({
            ipfsCid: 'bafy123',
            mimeType: 'image/jpeg',
            url: 'https://r2.signarank.club/bafy123',
        });
        expect(uploadFileMock).toHaveBeenCalledTimes(1);
        expect(s3SendMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed data URL before calling either upstream service', async () => {
        const service = createCharacterMediaUploadService(CONFIG);
        await expect(service.uploadFromDataUrl('not-a-data-url', 'avatar.jpg')).rejects.toThrow(
            'Invalid data URL format',
        );
        expect(uploadFileMock).not.toHaveBeenCalled();
        expect(s3SendMock).not.toHaveBeenCalled();
    });

    it('wraps a Pinata failure with context', async () => {
        uploadFileMock.mockRejectedValue(new Error('pinata down'));
        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;
        await expect(service.uploadFromDataUrl(dataUrl, 'a.png')).rejects.toThrow(/Failed to upload to Pinata/);
    });

    it('wraps an R2 failure with context', async () => {
        uploadFileMock.mockResolvedValue({ cid: 'bafy999' });
        s3SendMock.mockRejectedValue(new Error('r2 down'));
        const service = createCharacterMediaUploadService(CONFIG);
        const dataUrl = `data:image/png;base64,${Buffer.from('x').toString('base64')}`;
        await expect(service.uploadFromDataUrl(dataUrl, 'a.png')).rejects.toThrow(/Failed to upload to R2/);
    });
});
