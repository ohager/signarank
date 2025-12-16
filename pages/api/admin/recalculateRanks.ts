import type {NextApiRequest, NextApiResponse} from 'next'
import {prisma} from '@lib/prisma';
import {verifyAdminAuth} from '@lib/adminAuth';

/**
 * Recalculates ranks for all addresses based on current scores.
 * This is a safety net to fix any rank drift from concurrent updates.
 *
 * This endpoint can be called:
 * 1. Manually via POST /api/admin/recalculateRanks
 * 2. Automatically via Vercel cron job (configured in vercel.json)
 *
 * For large tables (>10k addresses), this may take 1-5 minutes.
 *
 * IMPORTANT: Requires authentication (CRON_SECRET or NEXT_SERVER_ADMIN_SECRET).
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        // Verify authentication
        if (!verifyAdminAuth(req, res)) {
            return; // Response already sent by verifyAdminAuth
        }

        const startTime = Date.now();

        // Update all rankings using a single SQL query
        // This is more efficient than updating each row individually
        await prisma.$executeRaw`
            UPDATE "Address"
            SET "ranking" = (
                SELECT COUNT(*) + 1
                FROM "Address" AS a2
                WHERE a2.score > "Address".score
            )
        `;

        const duration = Date.now() - startTime;

        // Get count of addresses updated
        const totalAddresses = await prisma.address.count();

        res.status(200).json({
            success: true,
            message: `Recalculated ranks for ${totalAddresses} addresses`,
            duration: `${duration}ms`
        });
    } catch (e: any) {
        console.error('recalculateRanks error:', e);
        res.status(500).json({
            error: 'Failed to recalculate ranks',
            message: e.message
        });
    }
}
