-- Drop old 'rank' column if it exists (from previous migration attempt)
-- This avoids PostgreSQL reserved word conflict
ALTER TABLE "Address" DROP COLUMN IF EXISTS "rank";

-- AlterTable: Add 'ranking' column with default value
-- Note: Column renamed from 'rank' to 'ranking' to avoid PostgreSQL reserved word conflict
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "ranking" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS "Address_score_idx" ON "Address"("score");

CREATE INDEX IF NOT EXISTS "Address_ranking_idx" ON "Address"("ranking");

CREATE INDEX IF NOT EXISTS "Address_active_idx" ON "Address"("active");

CREATE INDEX IF NOT EXISTS "Address_updatedAt_idx" ON "Address"("updatedAt");

CREATE INDEX IF NOT EXISTS "Address_active_score_idx" ON "Address"("active", "score");

-- Populate ranking column with calculated values
-- This may take several minutes for large tables (>10k rows)
UPDATE "Address"
SET "ranking" = (
    SELECT COUNT(*) + 1
    FROM "Address" AS a2
    WHERE a2.score > "Address".score
)
WHERE "ranking" = 0;
