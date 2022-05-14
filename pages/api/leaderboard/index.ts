import type {NextApiRequest, NextApiResponse} from 'next'
import {boomify} from '@hapi/boom';
import {fetchLeaderboard} from './fetchLeaderboard';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const data = await fetchLeaderboard();
        res.status(200).json(data)
    } catch (e: any) {
        const boom = boomify(e)
        res.status(400).json(boom.output.payload)
    }
}
