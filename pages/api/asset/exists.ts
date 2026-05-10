import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, HeadObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? '';

function urlToKey(url: string): string {
    return url.replace(`${process.env.R2_PUBLIC_URL}/`, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url param' });
    }

    try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: urlToKey(url) }));
        res.setHeader('Cache-Control', 'public, max-age=900');
        return res.status(200).json({ exists: true });
    } catch (err) {
        if (err instanceof NoSuchKey || (err as any).$metadata?.httpStatusCode === 404) {
            res.setHeader('Cache-Control', 'public, max-age=900');
            return res.status(200).json({ exists: false });
        }
        return res.status(200).json({ exists: false, error: String(err) });
    }
}
