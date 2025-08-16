# DegenGuard

AI-powered monitoring and protection layer for DeFi wallets.

## Features

- **Live Portfolio Dashboard**: Real-time wallet monitoring using Coinbase Developer Platform
- **AI Rule Authoring**: Natural language rule creation converted to JSON DSL
- **Rule Execution Engine**: Automated rule evaluation and alert generation
- **Multi-Chain Support**: Monitor wallets across different blockchain networks

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL
- **AI**: Gemini for natural language processing
- **Blockchain Data**: Coinbase Developer Platform APIs
- **Package Manager**: pnpm

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database credentials
   ```

3. **Set up database**:
   ```bash
   # Create PostgreSQL database named 'degenguard'
   pnpm db:migrate
   pnpm db:seed
   ```

4. **Start development servers**:
   ```bash
   pnpm dev
   ```

5. **Start the rules engine worker**:
   ```bash
   pnpm worker
   ```

## API Keys Required

- **Coinbase Developer Platform**: Get API keys from [Coinbase Developer Platform](https://docs.cdp.coinbase.com/)
- **Google Gemini**: Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Architecture

- `src/client/` - React frontend application
- `src/server/` - Express.js backend API
- `src/shared/` - Shared types and utilities
- `src/database/` - Database schema and migrations
- `src/worker/` - Background rule evaluation engine

## Development

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: PostgreSQL on port 5432

## License

MIT
