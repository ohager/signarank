import type {NextApiRequest, NextApiResponse} from 'next'
import {prisma} from '@lib/prisma';
import {verifyAdminAuth} from '@lib/adminAuth';

/**
 * Prunes (deletes) all addresses with zero scores from the database.
 * This helps maintain database cleanliness by removing inactive accounts.
 *
 * This endpoint can be called:
 * 1. Automatically via Vercel cron job (configured in vercel.json)
 * 2. Manually via POST /api/admin/prune (requires NEXT_SERVER_ADMIN_SECRET)
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

        // Delete all addresses with zero scores
        const result = await prisma.address.deleteMany({
            where: {
                score: {
                    equals: 0
                }
            }
        });

        const duration = Date.now() - startTime;

        res.status(200).json({
            success: true,
            message: `Pruned ${result.count} addresses with zero scores`,
            duration: `${duration}ms`
        });
    } catch (e: any) {
        console.error('prune error:', e);
        res.status(500).json({
            error: 'Failed to prune addresses',
            message: e.message
        });
    }
}
