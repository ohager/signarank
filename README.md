# Signarank 🏆

An achievement and ranking system built on the Signum blockchain. Track your Signum journey through achievements, earn ranks, and compete on the global leaderboard.

## Overview

Signarank analyzes your on-chain activity on the Signum blockchain and awards achievements based on:
- Transactions sent and received
- NFTs owned
- Aliases registered
- Blocks mined
- Smart contracts deployed
- Token holdings
- Commitment percentage
- And more...

## Features

- ✅ **Achievement System**: Track progress across multiple achievement categories
- ✅ **Global Ranking**: Real-time leaderboard with optimized ranking calculations
- ✅ **Smart Caching**: 30-minute database cache + ISR for 90%+ cost reduction
- ✅ **Performance Optimized**: Database indexes, denormalized rankings, transaction-based updates
- ✅ **Admin Endpoints**: Secure cron jobs for maintenance tasks

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Neon PostgreSQL database ([sign up free](https://neon.tech))
- Vercel account (for deployment)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd signarank
npm install
```

### 2. Set Up Database

1. Create a Neon PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy your connection strings (both pooled and direct)

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Database (required)
DATABASE_URL=<your-neon-pooled-connection-string>
DIRECT_DATABASE_URL=<your-neon-direct-connection-string>

# Signum Network Configuration (required)
NEXT_PUBLIC_SIGNUM_DEFAULT_NODE=https://europe.signum.network
NEXT_PUBLIC_SIGNUM_RELIABLE_NODES=https://europe.signum.network,https://brazil.signum.network
NEXT_PUBLIC_SIGNUM_NETWORK=Signum
NEXT_PUBLIC_SIGNUM_EXPLORER=https://chain.signum.network

# NFT Service API (optional)
# Leave blank if you don't have access to the NFT service
# NFT-related achievements will return 0 count without these credentials
# To request access, contact the Signarank developers at:
# https://github.com/signum-network/signarank/issues
NEXT_SERVER_NFT_SERVICE_API_HOST=<nft-service-host-url>
NEXT_SERVER_NFT_SERVICE_API_KEY=<your-api-key>

# Cache TTL in seconds (optional, default: 1800)
# 1800 = 30 minutes (recommended for cost optimization)
# 240 = 4 minutes (1 block time, for maximum freshness)
NEXT_SERVER_CACHE_TTL_SECONDS=1800

# Admin secret for manual endpoint access (required for production)
# Generate with: openssl rand -base64 32
NEXT_SERVER_ADMIN_SECRET=<your-strong-random-secret>

# Development mode (optional, set to false in production)
DEVELOPMENT=false
```

### 4. Initialize Database

Run Prisma migrations to set up the database schema:

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations to database
npm run db:push
```

This will create the `Address` table with all necessary indexes and columns.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The application uses a single optimized table:

```prisma
model Address {
  id          Int      @id @default(autoincrement())
  address     String   @unique
  score       Int
  ranking     Int      @default(0)      // Denormalized for performance
  progress    String                     // JSON array of completed achievements
  name        String
  imageUrl    String
  description String
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Performance indexes
  @@index([score])
  @@index([ranking])
  @@index([active])
  @@index([updatedAt])
  @@index([active, score])
}
```

## NFT Service (Optional)

The application supports tracking NFT ownership for NFT-related achievements. This feature is **optional** and requires credentials to a private NFT API service.

**Without NFT service credentials:**
- The application will work normally
- NFT-related achievements will report 0 NFTs owned
- All other achievements will function correctly

**To enable NFT tracking:**
1. Contact the Signarank developers to request API access
2. Open an issue at: https://github.com/signum-network/signarank/issues
3. Add the credentials to your environment variables:
   ```bash
   NEXT_SERVER_NFT_SERVICE_API_HOST=<provided-host-url>
   NEXT_SERVER_NFT_SERVICE_API_KEY=<provided-api-key>
   ```

The NFT service is automatically disabled if these environment variables are not set.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- **Live Site**: [signarank.club](https://signarank.club)
- **Signum Network**: [signum.network](https://signum.network)
- **Documentation**: [docs.signum.network](https://docs.signum.network)

## Support

For questions or issues, please open a GitHub issue or reach out to the Signum community.
