# Coding Conventions

**Analysis Date:** 2026-02-09

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `LocationCard.tsx`, `VoteButton.tsx`, `MapView.tsx`)
- Utilities/libs: camelCase (e.g., `votes.ts`, `locations.ts`, `auth.ts`, `address.ts`)
- UI components: PascalCase in `/src/components/ui/` (e.g., `card.tsx`, `dialog.tsx`, `button.tsx`)
- API routes: nested path structure matching Next.js conventions (e.g., `/src/app/api/admin/locations/[id]/approve/route.ts`)

**Functions:**
- Public/exported functions: camelCase (e.g., `signInWithMagicLink`, `getNearbyLocations`, `colorFromScore`)
- React components: PascalCase (e.g., `LocationCard`, `ScoreDetails`, `SizeLabel`)
- Utilities and helpers: camelCase (e.g., `mapRowToScores`, `extractStreet`, `consolidateToMetros`)

**Variables:**
- Local/state variables: camelCase (e.g., `totalVotes`, `isAdmin`, `selectedLocationId`, `mapCenter`)
- Constants: UPPER_SNAKE_CASE (e.g., `ICON_SIZE`, `AUSTIN_CENTER`, `BASE_URL`)
- React hook state: camelCase with set prefix (e.g., `useState(false)` → `const [isOpen, setIsOpen]`)

**Types:**
- Interfaces: PascalCase with no "I" prefix (e.g., `Location`, `LocationScores`, `VotesState`, `AdminLocation`)
- Union/discriminated types: PascalCase (e.g., `ScoreFilterCategory`, `ReleasedFilter`)
- Record/object maps: camelCase (e.g., `colorText`, `overallCardBg`, `overallCardBorder`)

## Code Style

**Formatting:**
- ESLint with Next.js config (`eslint.config.mjs`)
- No explicit prettier config file — uses Next.js defaults
- Line length: No hard limit enforced
- Indentation: 2 spaces (JavaScript/TypeScript standard)

**Linting:**
- Tool: ESLint 9 (latest)
- Config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Run: `npm run lint`
- Global ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. Node/external libraries: `import { createClient } from "@supabase/supabase-js"`
2. React internals: `import { useState, useEffect } from "react"`
3. Relative imports from codebase: `import { Location } from "@/types"`, `import { cn } from "@/lib/utils"`
4. Component/UI imports: `import { Card } from "@/components/ui/card"`

**Path Aliases:**
- `@/` maps to `/src/` (Next.js default)
- Used throughout: `@/types`, `@/components`, `@/lib`, `@/app`
- All imports use absolute paths via `@/`, never relative `../` paths

## Error Handling

**Patterns:**
- Async functions return `{ error: Error | null }` object pattern (see `auth.ts`):
  ```typescript
  export async function signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error("Authentication not available in offline mode") };
    }
    const { error } = await supabase.auth.signInWithOtp({...});
    return { error: error ? new Error(error.message) : null };
  }
  ```
- Offline-first design: Check `isSupabaseConfigured` before calling Supabase (see `votes.ts`, `locations.ts`)
- Silent failures in utility functions: Log errors but return null/empty defaults (see `auth.ts` `getSession`, `getUser`)
- API routes: Return `NextResponse.json({ error: message }, { status: code })` on failures

## Logging

**Framework:** `console.error` for errors; no dedicated logging library

**Patterns:**
- Use `console.error` only when information is lost (e.g., session fetch fails in `auth.ts`)
- No verbose logging for normal flows
- Error messages include context (e.g., `"Error getting session: {error}"`)

## Comments

**When to Comment:**
- Explain non-obvious logic (e.g., seeded random in `locations.ts` for deterministic mock data)
- Mark filter logic branches for admin vs. non-admin (e.g., `// Non-admins (or view-as-parent): always released only`)
- Link to requirements: reference test IDs (e.g., `// TC-1.1.1: Map canvas fills viewport`)

**JSDoc/TSDoc:**
- Used selectively on public utilities and complex functions
- Examples:
  ```typescript
  /**
   * Card background tint for selected cards
   */
  export const overallCardBg: Record<string, string> = {...}

  /**
   * Generate a color from a 0-1 sub-score
   */
  function colorFromScore(score: number | null): string | null {...}
  ```
- Component props documented via TypeScript interfaces (e.g., `interface LocationCardProps {...}`)

## Function Design

**Size:** Functions are compact and focused
- Single responsibility (e.g., `colorFromScore` only maps 0-1 scores to colors)
- Utility helpers typically 5-30 lines
- Complex logic extracted to separate functions (e.g., `mapRowToScores` for score transformation)

**Parameters:**
- Functions accept typed objects over multiple primitives
- Example (good): `function fetchNearby(center: { lat: number; lng: number }) {}`
- Router parameters destructured from interfaces (e.g., `AdminLocation`, `Location`)

**Return Values:**
- Explicit return types on public functions
- Null/undefined for missing data (e.g., `getSession()` returns `session | null`)
- Union types for error handling (e.g., `{ error: Error | null }`)

## Module Design

**Exports:**
- Public functions explicitly exported at module level
- Internal helpers not exported (implicit private)
- Example from `auth.ts`: exports `signInWithMagicLink`, `signOut`, `getSession`, `getUser`

**Barrel Files:**
- Not used; direct imports from specific modules
- Encourages tree-shaking and explicit dependencies

## Type Safety

**TypeScript Usage:**
- Strict mode enabled
- All component props typed with interfaces
- Zustand store typed with `VotesState` interface
- Supabase row data mapped through explicit type functions (e.g., `mapRowToScores`)
- Type assertions (e.g., `(row.overall_color as string)`) used when Supabase JSON is loosely typed

**Null Handling:**
- Explicit null checks before use
- Optional chaining: `location.scores?.overallColor`
- Nullish coalescing: `(row.overall_color as string) || null`

---

*Convention analysis: 2026-02-09*
