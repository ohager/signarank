import { PinataSDK } from 'pinata';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface PinataConfig {
    jwt: string;
    gateway: string;
}

export interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
}

export interface UploadConfig {
    pinata: PinataConfig;
    r2: R2Config;
}

export interface UploadResult {
    ipfsCid: string;
    mimeType: string;
    url: string;
}

export interface CharacterMediaUploadService {
    uploadFromDataUrl(dataUrl: string, fileName: string): Promise<UploadResult>;
}

/**
 * Node-standard port of signarank-constructor's MediaUploadService
 * (packages/services/src/media/media.upload.service.ts), which targets Bun
 * (Bun.S3Client, filesystem paths) and isn't installed in this repo. This
 * app only ever has a base64 data URL from the browser's canvas crop step,
 * never a filesystem path, so only that entry point is ported.
 */
export function createCharacterMediaUploadService(config: UploadConfig): CharacterMediaUploadService {
    const pinataClient = new PinataSDK({
        pinataJwt: config.pinata.jwt,
        pinataGateway: config.pinata.gateway,
    });

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    async function uploadToPinata(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
        try {
            const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });
            const upload = await pinataClient.upload.public.file(file);
            return upload.cid;
        } catch (error) {
            throw new Error(`Failed to upload to Pinata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async function uploadToR2(fileBuffer: Buffer, ipfsCid: string, mimeType: string): Promise<string> {
        try {
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: config.r2.bucketName,
                    Key: ipfsCid,
                    Body: fileBuffer,
                    ContentType: mimeType,
                }),
            );
            return `${config.r2.publicUrl}/${ipfsCid}`;
        } catch (error) {
            throw new Error(`Failed to upload to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return {
        async uploadFromDataUrl(dataUrl: string, fileName: string): Promise<UploadResult> {
            const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
            if (!matches || !matches[1] || !matches[2]) {
                throw new Error('Invalid data URL format');
            }
            const mimeType = matches[1];
            const fileBuffer = Buffer.from(matches[2], 'base64');

            const ipfsCid = await uploadToPinata(fileBuffer, fileName, mimeType);
            const url = await uploadToR2(fileBuffer, ipfsCid, mimeType);

            return { ipfsCid, mimeType, url };
        },
    };
}
