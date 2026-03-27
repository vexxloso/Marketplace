# Architecture Overview

## Monorepo Structure
- `apps/web`: user-facing frontend
- `apps/api`: backend API and business logic
- `packages/types`: shared domain types/interfaces
- `packages/shared`: shared utilities/helpers
- `infra`: local infrastructure (Postgres, Redis)
- `docs`: product and architecture documentation

## Guiding Principles
- Keep domain logic in API services, not in UI.
- Keep shared contracts in `packages/types`.
- Build vertical slices feature-by-feature.
- Maintain strict role boundaries: guest, host, admin.

## Initial Delivery Plan
1. Auth + role guard foundations
2. Listings CRUD + simple search
3. Booking + availability validation
4. Stripe payment + webhook reliability
5. Reviews and admin moderation basics
