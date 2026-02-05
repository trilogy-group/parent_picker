# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md. For detailed architecture documentation, see [`architecture.md`](architecture.md).

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input to inform site selection decisions.

## Key Context

- Scaling Alpha School and affiliates to hundreds/thousands of locations
- Real estate expertise (sourcing, zoning, permitting) is hyper-local
- Alpha parents are highly connected in their communities - leverage this network
- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)

## Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| Framework | Next.js 15 (App Router) | TypeScript, src/ directory |
| Styling | Tailwind CSS + shadcn/ui | Button, Card, Dialog, Input components |
| Maps | Mapbox GL via react-map-gl/mapbox | Dynamic import (SSR disabled) |
| State | Zustand | Global state for locations, votes, selection |
| Database | Supabase | Falls back to mock data if not configured |
| Auth | Supabase Auth | Magic link sign-in |

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Deploy to Vercel (manual - not connected to GitHub)
npx vercel --prod

# Testing
source .venv/bin/activate && python tests/requirements.test.py  # Run test suite (requires dev server running)

# Linting
npm run lint         # Run ESLint
```

## Test-Driven Development

This project uses TDD. All requirements are documented in `requirements.md` with corresponding test cases.

**Key files:**
- `requirements.md` - Complete requirements specification (137 test cases)
- `tests/requirements.test.py` - Automated Playwright test suite (45 implemented tests)

**Before making changes:**
1. Read the relevant requirement in `requirements.md`
2. Ensure the test case exists
3. Run the test suite to verify current state
4. Make changes
5. Run tests again to verify
6. If fails, go back to #4 until you get it right

**Adding new features:**
1. Add requirement to `requirements.md` with test cases
2. Add test implementation to `tests/requirements.test.py`
3. Run tests (should fail)
4. Implement feature
5. Run tests (should pass)

## Environment Variables

Store in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=        # Get from mapbox.com
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL (optional - falls back to mock data)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (optional - falls back to mock data)
```

**Offline/Demo Mode:** If Supabase env vars are missing, app runs with mock data and local-only voting. Shows "Demo Mode" badge in header.

## MVP Scope

Duplicate the Sports Academy facilities map functionality:
- Full-screen map with blue overlay panel (desktop) / bottom sheet (mobile)
- View locations as markers on map
- Vote on existing locations
- Suggest new locations
- Search/filter locations

## Deployment

- **Hosting:** Vercel (https://parentpicker.vercel.app)
- **Deploy:** `npx vercel --prod` (manual - not connected to GitHub auto-deploy)

## Database Schema

See [`docs/schema-design.md`](docs/schema-design.md) for complete Supabase schema including:
- Tables: `pp_locations`, `pp_votes`, `pp_profiles`
- View: `pp_locations_with_votes`
- RLS policies
- SQL setup script and seed data

## Current Features

- Supabase database integration (with offline fallback)
- Magic link authentication
- Persistent vote storage (optimistic updates + async DB sync)
- Parent-suggested locations with geocoding

## Future Features

- Pre-scored locations database
- Parent-suggested locations trigger scoring workflow
- Low-scoring locations prompt parent assistance (zoning help, contacts)

## Architecture

See [`architecture.md`](architecture.md) for detailed technical architecture including state management, data flow, and key integration points.


**Deployed:** https://parentpicker.vercel.app

## File Structure

```
src/
├── app/
│   ├── layout.tsx      # Root layout with AuthProvider
│   ├── page.tsx        # Main page (full-screen map + overlay)
│   └── globals.css     # Tailwind + shadcn styles
├── components/
│   ├── Map.tsx         # Dynamic import wrapper
│   ├── MapView.tsx     # Mapbox GL map with markers
│   ├── LocationsList.tsx
│   ├── LocationCard.tsx
│   ├── VoteButton.tsx  # Vote button with auth check
│   ├── SuggestLocationModal.tsx
│   ├── AuthProvider.tsx # Session context + auth state
│   ├── AuthButton.tsx   # Sign in/out UI
│   ├── SignInPrompt.tsx # Reusable magic link form
│   └── ui/             # shadcn components
├── lib/
│   ├── supabase.ts     # Supabase client (null if not configured)
│   ├── auth.ts         # Auth helpers (magic link, sign out)
│   ├── locations.ts    # Fetch locations + suggest with geocoding
│   ├── votes.ts        # Zustand store with DB persistence
│   └── utils.ts        # Tailwind merge utility
└── types/
    └── index.ts        # TypeScript interfaces
```
