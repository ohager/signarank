import type { NextApiRequest, NextApiResponse } from 'next';
import { findNarrations } from '@lib/narration/repository';
import { pickNarration } from '@lib/narration/pickNarration';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    const { seasonName, constructName, locale, tags } = req.query;

    if (
        typeof seasonName !== 'string' || !seasonName ||
        typeof constructName !== 'string' || !constructName ||
        typeof locale !== 'string' || !locale ||
        typeof tags !== 'string'
    ) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const parsedTags = tags ? tags.split(',').filter(Boolean) : [];

    try {
        const candidates = await findNarrations({ seasonName, constructName, locale, tags: parsedTags });
        const picked = pickNarration(candidates, parsedTags);

        if (!picked) {
            return res.status(204).end();
        }

        return res.status(200).json({ text: picked.text });
    } catch (err) {
        console.error('Narration pick error:', err);
        return res.status(204).end();
    }
}
