# DegenGuard Setup Guide

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- pnpm (installed globally)

## Environment Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure your .env file with:**
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/degenguard

   # Coinbase Developer Platform
   CDP_API_KEY=your_cdp_api_key_here
   CDP_API_SECRET=your_cdp_api_secret_here

   # Google Gemini Configuration
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Security
   JWT_SECRET=your_jwt_secret_here
   ```

## Database Setup

1. **Create PostgreSQL database:**
   ```sql
   CREATE DATABASE degenguard;
   ```

2. **Run migrations:**
   ```bash
   pnpm db:migrate
   ```

3. **Seed demo data:**
   ```bash
   pnpm db:seed
   ```

## Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development servers:**
   ```bash
   pnpm dev
   ```

3. **Start background workers (in separate terminals):**
   ```bash
   # Rules evaluation engine
   pnpm worker

   # Data ingestion worker (optional for development)
   tsx src/worker/data-ingestion.ts
   ```

## Production Deployment

### Using Docker Compose

1. **Set environment variables in .env file**

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

1. **Build the application:**
   ```bash
   pnpm build
   ```

2. **Start production server:**
   ```bash
   pnpm start
   ```

## API Keys Required

### Coinbase Developer Platform
- Sign up at [Coinbase Developer Platform](https://docs.cdp.coinbase.com/)
- Create API credentials
- Add to CDP_API_KEY and CDP_API_SECRET

### Google Gemini
- Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Add to GEMINI_API_KEY

## Architecture Overview

- **Frontend:** React + TypeScript + Tailwind CSS (Port 3000)
- **Backend:** Express.js + TypeScript (Port 3001)
- **Database:** PostgreSQL (Port 5432)
- **Workers:** Rules Engine + Data Ingestion

## Key Features

✅ **Portfolio Dashboard** - Real-time portfolio metrics and visualizations
✅ **AI Rule Creation** - Natural language to JSON DSL conversion
✅ **Rule Engine** - Automated evaluation every 30 seconds
✅ **Alert System** - Notifications when rules trigger
✅ **Multi-Wallet Support** - Track multiple wallets across chains
✅ **Transaction History** - View wallet transaction feeds
✅ **Data Ingestion** - Automated polling from CDP APIs

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists and user has permissions

### API Key Issues
- Verify all required API keys are set in .env
- Check API key permissions and quotas
- Ensure .env file is in project root

### Build Issues
- Run `pnpm install` to ensure dependencies are installed
- Check Node.js version (requires 18+)
- Clear node_modules and reinstall if needed

## Development Notes

- The current CDP integration uses mock data for demo purposes
- Replace mock implementations with actual CDP API calls in production
- User authentication is simplified for MVP (uses demo user ID)
- Rules engine evaluates every 30 seconds in development
- Data ingestion worker runs every 5 minutes in production
