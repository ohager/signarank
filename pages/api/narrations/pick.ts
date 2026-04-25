import type { NextApiRequest, NextApiResponse } from 'next';
import { findNarrations } from '@lib/narration/repository';
import { pickNarration } from '@lib/narration/pickNarration';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { seasonName, constructName, locale, tags } = req.body;

    if (
        typeof seasonName !== 'string' || !seasonName ||
        typeof constructName !== 'string' || !constructName ||
        typeof locale !== 'string' || !locale ||
        !Array.isArray(tags)
    ) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const candidates = await findNarrations({ seasonName, constructName, locale });
        const picked = pickNarration(candidates, tags);

        if (!picked) {
            return res.status(204).end();
        }

        return res.status(200).json({
            id: picked.id,
            text: picked.text,
            tags: picked.tags,
        });
    } catch (err) {
        console.error('Narration pick error:', err);
        return res.status(204).end();
    }
}
