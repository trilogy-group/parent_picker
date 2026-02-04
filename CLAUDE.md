# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| Database | Stubbed (Supabase in v2) | Mock data in src/lib/locations.ts |

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

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

**Adding new features:**
1. Add requirement to `requirements.md` with test cases
2. Add test implementation to `tests/requirements.test.py`
3. Run tests (should fail)
4. Implement feature
5. Run tests (should pass)

## Environment Variables

Store in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=   # Get from mapbox.com
```

## MVP Scope

Duplicate the Sports Academy facilities map functionality:
- Full-screen map with blue overlay panel (desktop) / bottom sheet (mobile)
- View locations as markers on map
- Vote on existing locations
- Suggest new locations
- Search/filter locations

## Version 2.0 (Future - Do Not Build Yet)

- Supabase database integration
- User authentication
- Pre-scored locations database
- Parent-suggested locations trigger scoring workflow
- Low-scoring locations prompt parent assistance (zoning help, contacts)
- Persistent vote storage

**Key Invariant:** Ship MVP before adding any v2 complexity.

## File Structure

```
src/
├── app/
│   ├── layout.tsx      # Root layout with metadata
│   ├── page.tsx        # Main page (full-screen map + overlay)
│   └── globals.css     # Tailwind + shadcn styles
├── components/
│   ├── Map.tsx         # Dynamic import wrapper
│   ├── MapView.tsx     # Mapbox GL map with markers
│   ├── LocationsList.tsx
│   ├── LocationCard.tsx
│   ├── VoteButton.tsx
│   ├── SuggestLocationModal.tsx
│   └── ui/             # shadcn components
├── lib/
│   ├── locations.ts    # Mock data & stub functions
│   ├── votes.ts        # Zustand store
│   └── utils.ts        # Tailwind merge utility
└── types/
    └── index.ts        # TypeScript interfaces
```
