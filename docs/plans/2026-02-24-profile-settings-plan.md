# Profile Settings Popover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a settings popover behind a gear icon where logged-in parents can set their name and home address (geocoded for distance calcs), plus sign out.

**Architecture:** Add columns to existing `pp_profiles` table. Two API routes (GET/PUT) using supabase-admin for server-side geocoding. New `ProfilePopover` component replaces `AuthButton` in AltPanel header. On auth load, fetch profile and override browser geolocation with saved home address.

**Tech Stack:** Next.js API routes, Supabase (pp_profiles), Google Geocoding API (server-side), Google Places Autocomplete (client-side via `@react-google-maps/api`), Zustand store, Tailwind CSS, shadcn/ui Popover.

---

### Task 1: Add columns to pp_profiles

**Files:**
- No code files — Supabase SQL migration

**Step 1: Run SQL migration via Supabase MCP**

```sql
ALTER TABLE pp_profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS home_lat double precision,
  ADD COLUMN IF NOT EXISTS home_lng double precision;
```

**Step 2: Add RLS policy for users to update their own profile**

```sql
-- Check if SELECT policy exists; if not, add one
CREATE POLICY "Users can read own profile"
  ON pp_profiles FOR SELECT
  USING (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON pp_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**Step 3: Verify columns exist**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pp_profiles' AND column_name IN ('display_name', 'home_address', 'home_lat', 'home_lng');
```

Expected: 4 rows returned.

**Step 4: Commit** — N/A (no code files changed)

---

### Task 2: Create GET /api/profile route

**Files:**
- Create: `src/app/api/profile/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pp_profiles")
    .select("display_name, home_address, home_lat, home_lng")
    .eq("id", user.id)
    .single();

  if (error) {
    // No profile row yet — return empty
    return NextResponse.json({ display_name: null, home_address: null, home_lat: null, home_lng: null });
  }

  return NextResponse.json(data);
}
```

**Step 2: Test manually**

Run `npm run dev`, then curl with a valid session token:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/profile
```
Expected: JSON with profile fields.

**Step 3: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat: add GET /api/profile route"
```

---

### Task 3: Create PUT /api/profile route with server-side geocoding

**Files:**
- Modify: `src/app/api/profile/route.ts`

**Step 1: Add PUT handler with geocoding**

Add to the same route file:

```typescript
export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { display_name, home_address } = body as { display_name?: string; home_address?: string };

  // Geocode address if provided
  let home_lat: number | null = null;
  let home_lng: number | null = null;

  if (home_address?.trim()) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (apiKey) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(home_address)}&key=${apiKey}`;
      const res = await fetch(geocodeUrl);
      const geo = await res.json();
      if (geo.status === "OK" && geo.results?.[0]) {
        home_lat = geo.results[0].geometry.location.lat;
        home_lng = geo.results[0].geometry.location.lng;
      }
    }
  }

  const { data, error } = await supabase
    .from("pp_profiles")
    .upsert({
      id: user.id,
      display_name: display_name?.trim() || null,
      home_address: home_address?.trim() || null,
      home_lat,
      home_lng,
    }, { onConflict: "id" })
    .select("display_name, home_address, home_lat, home_lng")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Step 2: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat: add PUT /api/profile with server-side geocoding"
```

---

### Task 4: Create ProfilePopover component

**Files:**
- Create: `src/components/ProfilePopover.tsx`

**Step 1: Build the component**

A popover with gear icon trigger. When open: name input, address input (with Google Places Autocomplete), save button, logout link. Fetches profile on mount, saves on submit, pushes lat/lng to votes store.

Key behaviors:
- Use `@react-google-maps/api` `Autocomplete` component for address input (already have Google Maps key loaded)
- On save success: call `setUserLocation({ lat, lng })` from votes store if geocode returned coords
- Show success feedback briefly, then close
- Logout link at bottom calls `signOut()` from `@/lib/auth`

**Dependencies check:** Verify `@react-google-maps/api` is installed (used for Places Autocomplete). If not, install it.

**Step 2: Commit**

```bash
git add src/components/ProfilePopover.tsx
git commit -m "feat: add ProfilePopover component with address autocomplete"
```

---

### Task 5: Wire ProfilePopover into AltPanel

**Files:**
- Modify: `src/components/AltPanel.tsx` (lines 11, 200-202)

**Step 1: Replace AuthButton with ProfilePopover**

In AltPanel.tsx:
- Replace `import { AuthButton } from "./AuthButton"` with `import { ProfilePopover } from "./ProfilePopover"`
- Replace the `<AuthButton darkBg={false} />` at line 201 with `<ProfilePopover />`

The `ProfilePopover` handles both logged-in (gear icon + popover) and logged-out (sign-in button) states internally, so it's a drop-in replacement.

**Step 2: Run dev server and test**

```bash
npm run dev
```

Verify:
- Logged out: shows Sign In button as before
- Logged in: shows gear icon, click opens popover with name/address/logout
- Save address: distance values update on cards
- Logout works from popover

**Step 3: Commit**

```bash
git add src/components/AltPanel.tsx
git commit -m "feat: wire ProfilePopover into AltPanel header"
```

---

### Task 6: Load saved profile on auth and override geolocation

**Files:**
- Modify: `src/components/AuthProvider.tsx` (lines 56-64, 72-74)

**Step 1: Fetch profile after auth resolves, push to store**

After `loadUserVotes(session.user.id)`, also fetch `/api/profile` and if `home_lat`/`home_lng` exist, call `setUserLocation()` on the votes store. This way saved address takes priority over browser geolocation.

Add a helper inside the provider that fetches profile and sets location:

```typescript
const loadProfile = async (token: string) => {
  try {
    const res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const profile = await res.json();
      if (profile.home_lat && profile.home_lng) {
        setUserLocation({ lat: profile.home_lat, lng: profile.home_lng });
      }
    }
  } catch {}
};
```

Call it in both the initial session check and the `SIGNED_IN` event handler. Need to add `setUserLocation` to the destructured store methods.

**Step 2: Commit**

```bash
git add src/components/AuthProvider.tsx
git commit -m "feat: load saved profile address on auth for distance calcs"
```

---

### Task 7: Verify end-to-end and final commit

**Step 1: Full E2E test**

1. Start dev server
2. Sign in with magic link
3. Click gear icon — popover opens
4. Enter name and address, save
5. Verify distance values on location cards use saved address
6. Refresh page — verify profile loads and distances still show
7. Sign out from popover — verify it works
8. Sign back in — verify profile persists

**Step 2: Final cleanup commit if needed**
