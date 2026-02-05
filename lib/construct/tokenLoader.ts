/**
 * Token metadata loader using @signumjs/standards
 *
 * NOTE: Requires @signumjs/standards package:
 * npm install @signumjs/standards@^1.0.0-rc.75
 */

import { Ledger } from '@signumjs/core';
import { TokenMeta } from './types';
import { ConstructCache } from './cache';

// TODO: Uncomment when @signumjs/standards is installed
// import { SRC44, SRC44Resolver } from '@signumjs/standards';

export async function loadTokenMeta(ledger: Ledger, tokenId: string): Promise<TokenMeta> {
    // Check cache first
    const cached = ConstructCache.getTokenMeta(tokenId);
    if (cached) {
        return cached;
    }

    try {
        // Fetch asset info from blockchain
        const asset = await ledger.asset.getAsset({ assetId: tokenId });

        // TODO: When @signumjs/standards is installed, use SRC44 to get token branding
        // const resolver = new SRC44Resolver(ledger);
        // const descriptor = await resolver.resolveAsset(tokenId);
        // const iconUrl = descriptor?.avatar?.url;

        const meta: TokenMeta = {
            tokenId,
            name: asset.name,
            symbol: asset.name, // Use name as symbol for now
            decimals: asset.decimals,
            description: asset.description,
            iconUrl: undefined, // Will be populated from SRC44 branding
        };

        // Cache the result
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
