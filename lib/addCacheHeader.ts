import {ServerResponse} from 'http';

export const addCacheHeader = (res: ServerResponse, minutes: number) : ServerResponse => {
    res.setHeader('Cache-Control', `s-maxage=${minutes * 60}, stale-while-revalidate=${minutes * 60 * 2}`)
    return res;
}
