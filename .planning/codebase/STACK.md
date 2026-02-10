# Technology Stack

**Analysis Date:** 2026-02-09

## Languages

**Primary:**
- TypeScript 5 - All application code, API routes, components
- JavaScript (JSX/TSX) - React components and configuration

**Secondary:**
- SQL - Database migrations and RPC functions in Supabase
- Python - Test automation with Playwright

## Runtime

**Environment:**
- Node.js (no version constraint file present, inferred from Next.js 15 support)

**Package Manager:**
- npm (lockfile present: `package-lock.json`)

## Frameworks

**Core:**
- Next.js 15 (App Router) - Full-stack React framework with server components, TypeScript support
- React 18.3.1 - UI library with hooks and client components

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- shadcn/ui 1.4.3 - Pre-built accessible components (Button, Card, Dialog, Input)
- class-variance-authority 0.7.1 - Component variant management
- tailwind-merge 3.4.0 - Smart Tailwind class merging
- clsx 2.1.1 - Conditional className utility
- tw-animate-css 1.4.0 - Tailwind animation utilities

**Maps:**
- Mapbox GL 3.18.1 - Vector map rendering library
- react-map-gl 8.1.0 - React wrapper for Mapbox GL with SSR-safe dynamic import

**State Management:**
- Zustand 5.0.11 - Lightweight global state store for locations, votes, filters, UI state

**Database & Auth:**
- @supabase/supabase-js 2.94.1 - Supabase client for database, auth, RLS queries

**Email:**
- Resend 6.9.1 - Email delivery service for approval/rejection notifications

**Icons:**
- lucide-react 0.563.0 - Icon component library

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.94.1 - Enables location data, voting, auth via magic links. Falls back gracefully with mock data if not configured.
- react-map-gl 8.1.0 - Interactive map UI. Requires dynamic import to avoid SSR hydration mismatch with mapbox-gl.
- Zustand 5.0.11 - Global store drives filter state, location rendering, and vote synchronization.

**Infrastructure:**
- Tailwind CSS 4 - Build-time CSS processing via PostCSS
- TypeScript 5 - Type safety across all code paths
- ESLint 9 + eslint-config-next 16.1.6 - Code quality and Next.js best practices

## Configuration

**Environment:**
- `.env.local` file (source-controlled, secrets masked) - Contains Mapbox and Supabase credentials
- Required vars: `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server-only vars: `SUPABASE_SERVICE_ROLE_KEY` (for admin operations), `RESEND_API_KEY` (email), `ADMIN_EMAILS`, `NEXT_PUBLIC_ADMIN_EMAILS`
- Optional: If Supabase vars missing, app runs in offline mode with mock data and local-only voting

**Build:**
- `next.config.ts` - Transpiles mapbox-gl and react-map-gl, supports GitHub Pages export mode
- `tsconfig.json` - ES2017 target, strict mode, path alias `@/*` → `src/*`
- `postcss.config.mjs` - Tailwind CSS v4 processing
- `eslint.config.mjs` - ESLint v9 flat config with Next.js rules and TypeScript support

## Platform Requirements

**Development:**
- Node.js with npm
- macOS Keychain integration for Supabase CLI token storage (documented in architecture.md)
- Vercel CLI for manual deployment (`npx vercel --prod`)

**Production:**
- Vercel hosting (https://parentpicker.vercel.app)
- Manual deployment only (GitHub integration broken, uses Vercel CLI)
- Supabase PostgreSQL database (read/write via PostgREST)
- Mapbox API access for geocoding and vector tiles

---

*Stack analysis: 2026-02-09*
