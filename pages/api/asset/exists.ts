import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url param' });
    }

    try {
        const upstream = await fetch(url, { method: 'HEAD' });
        res.setHeader('Cache-Control', 'public, max-age=900');
        return res.status(200).json({ exists: upstream.ok, upstreamStatus: upstream.status });
    } catch (err) {
        return res.status(200).json({ exists: false, error: String(err) });
    }
}