import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * Verifies admin endpoint authentication.
 *
 * Supports two authentication methods:
 * 1. Vercel cron jobs using CRON_SECRET (set automatically by Vercel)
 * 2. Manual admin requests using NEXT_SERVER_ADMIN_SECRET (set by you)
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 * @returns true if authenticated, false otherwise (also sends 401 response)
 */
export function verifyAdminAuth(
    req: NextApiRequest,
    res: NextApiResponse
): boolean {
    // Get authorization header
    const authHeader = req.headers.authorization;

    // Check if it's a Vercel cron job (Vercel sets CRON_SECRET automatically)
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // Check if it's a manual admin request
    const isAdminRequest = authHeader === `Bearer ${process.env.NEXT_SERVER_ADMIN_SECRET}`;

    // Require at least one valid authentication method
    if (!isVercelCron && !isAdminRequest) {
        console.warn('Unauthorized admin endpoint attempt:', {
            path: req.url,
            method: req.method,
            hasAuthHeader: !!authHeader,
            hasCronSecret: !!process.env.CRON_SECRET,
            hasAdminSecret: !!process.env.NEXT_SERVER_ADMIN_SECRET,
            timestamp: new Date().toISOString()
        });

        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing authorization header'
        });

        return false;
    }

    return true;
}
