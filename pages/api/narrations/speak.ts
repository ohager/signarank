import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const apiKey = process.env.NEXT_SERVER_ELEVENLABS_API_KEY;
    const voiceId = process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID;
    const modelId = process.env.NEXT_SERVER_ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5';

    if (!apiKey || !voiceId) {
        return res.status(204).end();
    }

    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text is required' });
    }

    try {
        const upstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
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
