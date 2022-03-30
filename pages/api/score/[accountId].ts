// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type {NextApiRequest, NextApiResponse} from 'next'
import {calculateScore} from "./calculateSignaScore";
import {boomify, badGateway} from '@hapi/boom';
import {HttpError} from '@signumjs/http';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {

    try {
        const {accountId} = req.query;

        const address = Array.isArray(accountId) ? accountId[0] : accountId;
        const {props} = await calculateScore(address);
        const {score, rank} = props;
        res.status(200).json({score, rank})
    } catch (e: any) {
        if(e instanceof HttpError){
            const boom = badGateway(e.data)
            res.status(boom.output.statusCode).json(boom.output.payload)
        }
        else{
            const boom = boomify(e)
            res.status(400).json(boom.output.payload)
        }
    }
}
