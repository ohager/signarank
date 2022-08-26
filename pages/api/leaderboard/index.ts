import type {NextApiRequest, NextApiResponse} from 'next'
import {boomify} from '@hapi/boom';
import {fetchLeaderboard} from './fetchLeaderboard';
import {addCacheHeader} from '@lib/addCacheHeader';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const data = await fetchLeaderboard();
        addCacheHeader(res, 12*60)
        res.status(200).json(data)
    } catch (e: any) {
        const boom = boomify(e)
        res.status(400).json(boom.output.payload)
    }
}
