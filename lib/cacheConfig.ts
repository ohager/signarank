/**
 * Cache configuration for the application.
 *
 * Both database cache and ISR revalidation use the same TTL to ensure consistency.
 * Value can be configured via CACHE_TTL_SECONDS environment variable.
 *
 * Default: 1800 seconds (30 minutes) for cost optimization
 * Can be set to 240 seconds (4 minutes = 1 block time) for maximum freshness
 */

// Get cache TTL from environment variable, default to 30 minutes
const CACHE_TTL_SECONDS = parseInt(process.env.NEXT_SERVER_CACHE_TTL_SECONDS || '1800', 10);

// Convert to milliseconds for database cache checks
export const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

// Use directly for ISR revalidate parameter
export const ISR_REVALIDATE_SECONDS = CACHE_TTL_SECONDS;

// Helper to check if running in development mode
export const IS_DEVELOPMENT = process.env.DEVELOPMENT === 'true' || process.env.NODE_ENV === 'development';
