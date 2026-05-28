# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALE DAN CPL System — a full-stack quotation management platform for DAN (Digital Age Networking) product pricing. Users import monthly CPL (Customer Price List) Excel data, then create professional quotations with product selection, discounting, version tracking, and Excel export.

**Live site**: https://www.extremecloudiq.cn/
**Repo**: https://github.com/apllozhang/ale-dan-cpl-system

## Commands

```bash
npm run dev          # Start dev server (tsx watch, auto port detection starting 3000)
npm run build        # Production build (vite build + esbuild server bundle)
npm run start        # Run production server from dist/
npm run check        # TypeScript type checking (tsc --noEmit)
npm run test         # Run vitest (server tests only)
npm run format       # Prettier format all files
npm run db:push      # Generate + apply Drizzle migrations
```

Run a single test: `npx vitest run server/quotations.analytics.test.ts`

**Note**: Use `npm install --legacy-peer-deps` if install fails with ERESOLVE.

## Architecture

### Monorepo Structure

Single repo with shared TypeScript — no workspaces. Both client and server reference `@shared/*` via path aliases.

```
client/src/        → React frontend (Vite serves in dev, builds to dist/public)
server/            → Express + tRPC backend
shared/            → Shared types, constants, permission matrix
drizzle/           → DB schema (schema.ts) and migrations
```

### Path Aliases (tsconfig + vite + vitest)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Backend (server/)

- **Entry**: `server/_core/index.ts` — Express server with auto port detection (3000-3019), tRPC mounted at `/api/trpc`
- **tRPC setup**: `server/_core/trpc.ts` — procedure hierarchy: `publicProcedure` → `protectedProcedure` → `adminProcedure` → `superAdminProcedure` + `permissionProcedure(perm)` factory
- **Context/auth**: `server/_core/context.ts` — cookie-based session (`app_session_id`), JWT verification
- **Business logic**: `server/db.ts` — all database operations via Drizzle ORM. **Critical**: `db.execute(rawSQL)` returns `[rows, fields]` tuple in mysql2, always extract with `Array.isArray(result[0]) ? result[0] : result`
- **Routes**: `server/routers.ts` — single merged `appRouter` with nested routers: `auth`, `products`, `quotations`, `versions`, `templates`, `sharing`, `admin`, `import`, `export`, `analytics`

### Frontend (client/src/)

- **Routing**: Wouter (`client/src/App.tsx`) — `/login` outside DashboardLayout, all dashboard routes inside
- **State/data**: tRPC React Query hooks via `@/lib/trpc` — `trpc.quotations.list.useQuery()`, `trpc.quotations.create.useMutation()`, etc.
- **Auth**: `@/_core/hooks/useAuth` — wraps `trpc.auth.me` query + auto-redirect
- **Theme**: `@/contexts/ThemeContext` — adds/removes `dark` class on `<html>`. Login page overrides this to always stay light.
- **i18n**: react-i18next with 6 locales in `client/src/i18n/locales/` (zh, zh-TW, en, ja, es, fr). All UI text goes through `useTranslation()`.
- **Animations**: GSAP (`gsap` + `@gsap/react`) for login carousel and entrance animations. Framer Motion available but GSAP is primary.

### Database

- **MySQL 8** via Drizzle ORM, connection string in `DATABASE_URL` env var
- **Schema**: `drizzle/schema.ts` — 13+ tables including `users`, `quotations`, `quotation_items`, `quotation_versions`, `cpl_products`, `organizations`, `user_groups`
- **Key schema details**:
  - Users have `role` enum (user/admin/sales_manager/sales_rep/viewer) + `isSuperAdmin` boolean
  - Quotations have version tracking: `quotations.version` (int), `quotation_versions.snapshot` (JSON text)
  - Permission matrix defined in `shared/const.ts` (`ROLE_PERMISSIONS` map)

### Discount Calculation

Discount rate is a direct multiplier: `subtotal = unitPrice × quantity × (discountRate / 100)`. So 10% discount means multiply by 0.1. This formula must be consistent across `server/routers.ts` (update mutation), `client/src/pages/QuotationDetail.tsx`, and `client/src/lib/quotationExportPro.ts`.

### Version Tracking

Quotation versioning is automatic on every save (`updateQuotation` in `server/db.ts`):
1. Snapshot current items/state as JSON before update
2. Compute diff (added/removed/modified products by `productModel`)
3. Store in `quotation_versions` with change summary
4. Frontend `VersionTimeline` component in `QuotationDetail.tsx` shows history and supports two-version diff comparison

## Environment

- **Platform**: Windows (use Unix shell syntax in bash, forward slashes in paths)
- **Git proxy**: `git config http.proxy http://127.0.0.1:10808` (if needed)
- **Database**: `mysql://root:@localhost:3306/ale_cpl` (default .env)
- **Node**: ES modules (`"type": "module"` in package.json)
