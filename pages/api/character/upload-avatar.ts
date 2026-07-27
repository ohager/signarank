import type { NextApiRequest, NextApiResponse } from 'next';
import { createCharacterMediaUploadService } from '@lib/character/mediaUpload.server';
import { AVATAR_MAX_BYTES } from '@lib/character/constants';
import { R2_CDN_BASE } from '@lib/construct/constants';

export const config = {
    api: {
        // Base64 data URLs run ~33% larger than the underlying binary, plus
        // JSON overhead — pad generously above AVATAR_MAX_BYTES (2MiB).
        bodyParser: { sizeLimit: '4mb' },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { dataUrl, fileName } = req.body ?? {};

    if (typeof dataUrl !== 'string' || !dataUrl || typeof fileName !== 'string' || !fileName) {
        return res.status(400).json({ error: 'Missing required fields: dataUrl, fileName' });
    }

    const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
    const approxBytes = base64Length * 0.75;
    if (approxBytes > AVATAR_MAX_BYTES) {
        return res.status(413).json({ error: 'Image exceeds maximum size' });
    }

    const { PINATA_JWT, PINATA_GATEWAY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
        process.env;

    if (!PINATA_JWT || !PINATA_GATEWAY || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        console.error('upload-avatar: missing upload service configuration');
        return res.status(500).json({ error: 'Upload service is not configured' });
    }

    try {
        const service = createCharacterMediaUploadService({
            pinata: { jwt: PINATA_JWT, gateway: PINATA_GATEWAY },
            r2: {
                accountId: R2_ACCOUNT_ID,
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
                bucketName: R2_BUCKET_NAME,
                // Character avatars mirror into the same bucket/CDN base
                // constructs already use (per the design spec, Part 2's
                // "Current state" — "character avatars mirror into the same
                // bucket, new object keys"), not a new per-feature subdomain.
                publicUrl: R2_CDN_BASE,
            },
        });

        const result = await service.uploadFromDataUrl(dataUrl, fileName);
        return res.status(200).json(result);
    } catch (err) {
        console.error('upload-avatar error:', err);
        return res.status(502).json({ error: 'Avatar upload failed' });
    }
}
