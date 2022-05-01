import {Http, HttpClientFactory} from '@signumjs/http';

interface Props {
    hostUrl: string;
    apiKey: string;
}

export class NftService {
    private service: Http;
    constructor({hostUrl, apiKey}: Props) {
        this.service = HttpClientFactory.createHttpClient(hostUrl, {
            headers: {'x-api-key': apiKey},
        })
    }

    async getNftCountPerAccount(accountId: string) : Promise<number>{
        const { response } = await this.service.get(`api/items?ownerId=${accountId}&p=50`)
        return response.data && Array.isArray(response.data) ? response.data.length : 0;
    }
}
