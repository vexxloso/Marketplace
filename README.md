# Marketplace Monorepo

Production-oriented marketplace built as a `pnpm` monorepo with:
- `apps/web`: Next.js frontend
- `apps/api`: Fastify + Prisma backend
- `docs`: product and deployment notes

## Implemented Features
- authentication and roles (`guest`, `host`, `admin`)
- listings CRUD
- search and filters
- bookings
- reviews and ratings
- local image uploads
- user dashboard
- messaging
- notifications
- admin panel
- Stripe payment scaffold

## Docs
- product requirements: `docs/PRODUCT_REQUIREMENTS.md`
- architecture notes: `docs/ARCHITECTURE.md`
- deployment notes: `docs/DEPLOYMENT.md`

## Environment Setup

### Root
Copy:
- `.env.example` -> `.env`

Useful root values:
- `NODE_ENV`
- `ADMIN_EMAIL` for the reusable admin-promotion script

### API
Copy:
- `apps/api/.env.example` -> `apps/api/.env`

Required values:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`

Optional until live Stripe setup:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Web
Copy:
- `apps/web/.env.example` -> `apps/web/.env.local`

Default local value:
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000`

## Local Run
1. Install dependencies:
   - `pnpm install`
2. Run API:
   - `pnpm --filter @market/api dev`
3. Run web:
   - `pnpm --filter @market/web dev`
4. Promote the root `ADMIN_EMAIL` user after signup:
   - `pnpm admin:promote`

## Useful Routes
- web: `http://127.0.0.1:3001`
- listings: `http://127.0.0.1:3001/listings`
- auth: `http://127.0.0.1:3001/auth`
- dashboard: `http://127.0.0.1:3001/dashboard`
- admin: `http://127.0.0.1:3001/admin`
- api health: `http://127.0.0.1:4000/health`

## Notes
- the app currently stores JWTs in local storage for development simplicity
- live Stripe checkout requires real Stripe keys and webhook forwarding
- Neon Postgres works well for the current setup
