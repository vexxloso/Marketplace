# Deployment Notes

## Services
- `apps/web`: Next.js app
- `apps/api`: Fastify API
- PostgreSQL: Neon or any managed Postgres

## Environment

### API: `apps/api/.env`
- `NODE_ENV=production`
- `PORT=4000`
- `APP_URL=https://your-web-domain`
- `DATABASE_URL=...`
- `DIRECT_URL=...`
- `JWT_SECRET=...`
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`

### Web: `apps/web/.env`
- `NEXT_PUBLIC_API_URL=https://your-api-domain`

## Build

### API
```bash
pnpm --filter @market/api build
```

### Web
```bash
pnpm --filter @market/web build
```

## Run

### API
```bash
pnpm --filter @market/api dev
```

### Web
```bash
pnpm --filter @market/web start
```

## Stripe
- Set `APP_URL` to the deployed web URL.
- Point Stripe webhook forwarding/production webhook to:
  - `/payments/webhook`
- For local testing:
```bash
stripe listen --forward-to http://127.0.0.1:4000/payments/webhook
```

## Deployment Suggestions
- Web: Vercel
- API: Railway, Render, Fly.io, or a VPS
- Database: Neon

## Before Production
- rotate all secrets
- set real Stripe keys
- add rate limiting
- add real tests
- add HTTPS-only deployment
