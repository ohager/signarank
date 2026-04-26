import {type Asset, Ledger} from '@signumjs/core';
import {TokenMeta} from './types';
import {ConstructCache} from './cache';
import {src44} from "@signumjs/standards"
import {Config} from "@components/contexts/AppContext";

function getTokenDescriptor(asset: Asset) {
    try {
        const descriptor = src44.DescriptorData.parse(asset.description, false);
        return {
            description: descriptor.description,
            iconUrl: descriptor.avatar?.ipfsCid ? Config.Ipfs.Gateway + '/' + descriptor.avatar.ipfsCid : undefined,
        }
    } catch {
        return {
            description: asset.description,
            iconUrl: undefined,
        }
    }
}

export async function loadTokenMeta(ledger: Ledger, tokenId: string): Promise<TokenMeta> {
    // Check cache first
    const cached = ConstructCache.getTokenMeta(tokenId);
    if (cached) {
        return cached;
    }

    try {
        const asset = await ledger.asset.getAsset({assetId: tokenId});
        const {description, iconUrl} = getTokenDescriptor(asset)
        const meta: TokenMeta = {
            tokenId,
            name: asset.name,
            symbol: asset.name, // Use name as symbol for now
            decimals: asset.decimals,
            description,
            iconUrl,
        };
        ConstructCache.setTokenMeta(tokenId, meta);
        return meta;
    } catch (error) {
        console.error(`Failed to load token metadata for ${tokenId}:`, error);

        // Return minimal metadata
        return {
            tokenId,
            name: `Token ${tokenId}`,
            decimals: 0,
        };
    }
}

export async function loadMultipleTokenMeta(ledger: Ledger, tokenIds: string[]): Promise<TokenMeta[]> {
    const results = await Promise.all(
        tokenIds.map(id => loadTokenMeta(ledger, id))
    );
    return results;
}
