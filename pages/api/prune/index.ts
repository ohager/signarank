import type {NextApiRequest, NextApiResponse} from 'next'
import {boomify} from '@hapi/boom';
import {removeAllZeroScores} from "./removeAllZeroScores";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        await removeAllZeroScores();
        res.status(204).end()
    } catch (e: any) {
        const boom = boomify(e)
        res.status(400).json(boom.output.payload)
    }
}
