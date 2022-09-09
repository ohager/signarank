import {NextApiRequest, NextApiResponse} from 'next';
import {calculateScore} from './calculateSignaScore';
import {singleQueryString} from '@lib/singleQueryString';
import {HttpError} from '@signumjs/http';
import {badGateway, boomify} from '@hapi/boom';
import {addCacheHeader} from '@lib/addCacheHeader';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const {accountId} = req.query;
        const {props} = await calculateScore(singleQueryString(accountId));
        const {score, rank} = props;
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET')
        addCacheHeader(res, 24*60)
        res.status(200).json({score, rank})
    } catch (e: any) {
        if (e instanceof HttpError) {
            const boom = badGateway(e.data)
            res.status(boom.output.statusCode).json(boom.output.payload)
        } else {
            const boom = boomify(e)
            res.status(400).json(boom.output.payload)
        }
    }
}
