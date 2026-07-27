import { AVATAR_MAX_DIMENSION_PX, AVATAR_MAX_BYTES } from './constants';

export interface ImageDimensions {
    width: number;
    height: number;
    sizeBytes: number;
}

export interface ImageConstraintCheck {
    needsResize: boolean;
    needsCompress: boolean;
}

/** Pure bounds check — no DOM access, safe to unit test under Node. */
export function checkImageConstraints(dims: ImageDimensions): ImageConstraintCheck {
    return {
        needsResize: dims.width > AVATAR_MAX_DIMENSION_PX || dims.height > AVATAR_MAX_DIMENSION_PX,
        needsCompress: dims.sizeBytes > AVATAR_MAX_BYTES,
    };
}

export interface CroppedImage {
    dataUrl: string;
    mimeType: string;
}

/** Shape returned by POST /api/character/upload-avatar. Lives here (not in a
 * component) because both the create form and any future avatar-edit UI need
 * it, and it's conceptually part of this module's avatar-handling contract. */
export interface UploadedAvatar {
    ipfsCid: string;
    mimeType: string;
    url: string;
}

/**
 * Browser-only: reads an image File, center-crops it to a square, resizes it
 * to fit within AVATAR_MAX_DIMENSION_PX, and re-encodes as JPEG at a quality
 * chosen to fit under AVATAR_MAX_BYTES. Not unit-tested (needs canvas/Image,
 * which this repo's Vitest setup doesn't provide) — verify manually in the
 * browser per Task 11's checklist. Mirrors how other DOM-heavy code in this
 * repo (e.g. components/Construct/AttackForm.tsx) has no unit test either.
 */
export async function cropAndResizeToDataUrl(file: File): Promise<CroppedImage> {
    const imageBitmap = await createImageBitmap(file);
    const side = Math.min(imageBitmap.width, imageBitmap.height);
    const sx = (imageBitmap.width - side) / 2;
    const sy = (imageBitmap.height - side) / 2;
    const targetSide = Math.min(side, AVATAR_MAX_DIMENSION_PX);

    const canvas = document.createElement('canvas');
    canvas.width = targetSide;
    canvas.height = targetSide;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(imageBitmap, sx, sy, side, side, 0, 0, targetSide, targetSide);

    let quality = 0.92;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length * 0.75 > AVATAR_MAX_BYTES && quality > 0.4) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return { dataUrl, mimeType: 'image/jpeg' };
}
