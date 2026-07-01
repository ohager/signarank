import type { NextApiRequest, NextApiResponse } from 'next';
import { findNarrations } from '@lib/narration/repository';
import { pickNarration } from '@lib/narration/pickNarration';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    const expectedKey = process.env.NEXT_PUBLIC_NARRATION_API_KEY;
    if (expectedKey && req.headers['x-narration-key'] !== expectedKey) {
        return res.status(401).end();
    }

    const apiKey = process.env.NEXT_SERVER_ELEVENLABS_API_KEY;
    const voiceId = process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID;
    const modelId = process.env.NEXT_SERVER_ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5';

    if (!apiKey || !voiceId) {
        return res.status(204).end();
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

        const upstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: picked.text,
                    model_id: modelId,
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            }
        );

        if (!upstream.ok) {
            return res.status(204).end();
        }

        const audioBuffer = await upstream.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).end(Buffer.from(audioBuffer));
    } catch {
        return res.status(204).end();
    }
}
