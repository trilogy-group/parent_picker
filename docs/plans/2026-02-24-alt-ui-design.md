# Alt UI Left Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the parent-facing left panel with a community-focused "I'm in" / "Not here" voting UI, voter avatars, invite-a-family, and launch threshold.

**Architecture:** New components (`AltPanel`, `AltLocationCard`, `AvatarRow`, `InviteModal`) alongside existing ones. Admin UI untouched. DB adds `vote_type` to `pp_votes`, `not_here_count` to `pp_locations`, new `pp_invites` table, and a `get_location_voters` RPC. Zustand store extended for dual vote types and voter details.

**Tech Stack:** Next.js 15, Tailwind CSS, Zustand, Supabase (Postgres + RPC), Resend (email)

---

## Task 1: DB Migration — vote_type + not_here_count

**Files:**
- Supabase SQL migration (run via MCP)

**Step 1: Add vote_type column to pp_votes**

```sql
ALTER TABLE pp_votes
  ADD COLUMN vote_type text NOT NULL DEFAULT 'in'
  CHECK (vote_type IN ('in', 'not_here'));
```

Existing rows auto-get `vote_type = 'in'` via the DEFAULT.

**Step 2: Add not_here_count to pp_locations**

```sql
ALTER TABLE pp_locations
  ADD COLUMN not_here_count integer NOT NULL DEFAULT 0;
```

**Step 3: Replace the vote count trigger**

The existing `pp_update_vote_count` trigger increments/decrements `vote_count` on every INSERT/DELETE. Replace it to be vote_type-aware and handle UPDATEs (for switching vote type):

```sql
CREATE OR REPLACE FUNCTION pp_update_vote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'in' THEN
      UPDATE pp_locations SET vote_count = vote_count + 1 WHERE id = NEW.location_id;
    ELSIF NEW.vote_type = 'not_here' THEN
      UPDATE pp_locations SET not_here_count = not_here_count + 1 WHERE id = NEW.location_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'in' THEN
      UPDATE pp_locations SET vote_count = vote_count - 1 WHERE id = OLD.location_id;
    ELSIF OLD.vote_type = 'not_here' THEN
      UPDATE pp_locations SET not_here_count = not_here_count - 1 WHERE id = OLD.location_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type <> NEW.vote_type THEN
      IF OLD.vote_type = 'in' THEN
        UPDATE pp_locations SET vote_count = vote_count - 1 WHERE id = OLD.location_id;
      ELSIF OLD.vote_type = 'not_here' THEN
        UPDATE pp_locations SET not_here_count = not_here_count - 1 WHERE id = OLD.location_id;
      END IF;
      IF NEW.vote_type = 'in' THEN
        UPDATE pp_locations SET vote_count = vote_count + 1 WHERE id = NEW.location_id;
      ELSIF NEW.vote_type = 'not_here' THEN
        UPDATE pp_locations SET not_here_count = not_here_count + 1 WHERE id = NEW.location_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
```

**Step 4: Update the trigger to fire on UPDATE too**

```sql
DROP TRIGGER pp_vote_count_trigger ON pp_votes;
CREATE TRIGGER pp_vote_count_trigger
  AFTER INSERT OR DELETE OR UPDATE OF vote_type ON pp_votes
  FOR EACH ROW EXECUTE FUNCTION pp_update_vote_count();
```

**Step 5: Verify** — Insert a test vote and check counts update correctly. Rollback test row.

**Step 6: Commit** — `git commit -m "db: add vote_type to pp_votes, not_here_count to pp_locations"`

---

## Task 2: DB Migration — pp_invites table

**Step 1: Create pp_invites table**

```sql
CREATE TABLE pp_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pp_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own invites"
  ON pp_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can read their own invites"
  ON pp_invites FOR SELECT
  USING (auth.uid() = inviter_id);
```

**Step 2: Commit** — `git commit -m "db: create pp_invites table"`

---

## Task 3: DB — get_location_voters RPC

Returns voter initials + vote_type for a set of location IDs (used by avatar row).

**Step 1: Create the RPC function**

```sql
CREATE OR REPLACE FUNCTION get_location_voters(location_ids uuid[])
RETURNS TABLE(
  location_id uuid,
  user_id uuid,
  vote_type text,
  display_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.location_id,
    v.user_id,
    v.vote_type,
    p.display_name,
    p.email
  FROM pp_votes v
  JOIN pp_profiles p ON p.id = v.user_id
  WHERE v.location_id = ANY(location_ids)
  ORDER BY v.created_at ASC;
END;
$$;
```

**Step 2: Update get_nearby_locations to return not_here_count**

```sql
CREATE OR REPLACE FUNCTION get_nearby_locations(
  center_lat double precision,
  center_lng double precision,
  max_results integer DEFAULT 500,
  released_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, name text, address text, city text, state text,
  lat double precision, lng double precision,
  vote_count integer, not_here_count integer,
  source text, released boolean,
  overall_color text, overall_details_url text,
  price_color text, zoning_color text,
  neighborhood_color text, building_color text,
  size_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.name, l.address, l.city, l.state,
    l.lat::double precision, l.lng::double precision,
    l.vote_count, l.not_here_count,
    l.source, l.released,
    s.overall_color, s.overall_details_url,
    s.price_color, s.zoning_color,
    s.neighborhood_color, s.building_color,
    s.size_classification
  FROM pp_locations l
  LEFT JOIN pp_location_scores s ON s.location_id = l.id
  WHERE l.status = 'active'
    AND (NOT released_only OR l.released = true)
  ORDER BY (l.lat - center_lat)^2 + (l.lng - center_lng)^2
  LIMIT max_results;
END;
$$;
```

**Step 3: Commit** — `git commit -m "db: get_location_voters RPC, add not_here_count to nearby query"`

---

## Task 4: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Update Location interface**

Add `notHereVotes` field to `Location`:

```typescript
export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  votes: number;          // count of 'in' votes (existing)
  notHereVotes: number;   // count of 'not_here' votes (new)
  suggested?: boolean;
  released?: boolean;
  scores?: LocationScores;
}
```

**Step 2: Add VoterInfo and VoteType types**

```typescript
export type VoteType = 'in' | 'not_here';

export interface VoterInfo {
  userId: string;
  voteType: VoteType;
  displayName: string | null;
  email: string;
}
```

**Step 3: Fix all references to Location** — `notHereVotes` needs a default of 0 everywhere a Location is constructed (in `locations.ts` getNearbyLocations mapper, mock data, deep link handler in `page.tsx`, etc.).

In `src/lib/locations.ts` `getNearbyLocations` mapper, add:
```typescript
notHereVotes: Number(row.not_here_count) || 0,
```

In mock data arrays (`src/lib/locations.ts`), add `notHereVotes: 0` to each entry.

In `src/app/page.tsx` DeepLinkHandler, add `notHereVotes: 0` to the constructed location.

**Step 4: Commit** — `git commit -m "feat: add notHereVotes to Location type, VoterInfo interface"`

---

## Task 5: Zustand Store — Vote Type + Voter Loading

**Files:**
- Modify: `src/lib/votes.ts`

**Step 1: Add new state fields to VotesState interface**

```typescript
// Add to interface:
votedNotHereIds: Set<string>;
locationVoters: Map<string, VoterInfo[]>;
sortMode: 'most_support' | 'most_viable';

// Add new actions:
voteIn: (locationId: string) => void;
voteNotHere: (locationId: string) => void;
removeVote: (locationId: string) => void;
setSortMode: (mode: 'most_support' | 'most_viable') => void;
loadLocationVoters: (locationIds: string[]) => Promise<void>;
```

**Step 2: Initialize new state**

```typescript
votedNotHereIds: new Set<string>(),
locationVoters: new Map(),
sortMode: 'most_support' as const,
```

**Step 3: Update loadUserVotes to load vote_type**

Change the query from:
```typescript
.select("location_id")
```
to:
```typescript
.select("location_id, vote_type")
```

Then split into two sets:
```typescript
const inIds = new Set(data.filter(v => v.vote_type === 'in').map(v => v.location_id));
const notHereIds = new Set(data.filter(v => v.vote_type === 'not_here').map(v => v.location_id));
set({ votedLocationIds: inIds, votedNotHereIds: notHereIds });
```

**Step 4: Implement voteIn action**

Uses UPSERT — if user already has a 'not_here' vote on this location, switches to 'in':
```typescript
voteIn: (locationId) => {
  const state = get();
  const wasNotHere = state.votedNotHereIds.has(locationId);
  const alreadyIn = state.votedLocationIds.has(locationId);
  if (alreadyIn) return;

  // Optimistic update
  const newInIds = new Set([...state.votedLocationIds, locationId]);
  const newNotHereIds = new Set(state.votedNotHereIds);
  newNotHereIds.delete(locationId);
  set({
    locations: state.locations.map(loc =>
      loc.id === locationId ? {
        ...loc,
        votes: loc.votes + 1,
        notHereVotes: wasNotHere ? loc.notHereVotes - 1 : loc.notHereVotes,
      } : loc
    ),
    votedLocationIds: newInIds,
    votedNotHereIds: newNotHereIds,
  });

  // Persist: upsert
  if (state.userId && isSupabaseConfigured && supabase) {
    supabase
      .from("pp_votes")
      .upsert(
        { location_id: locationId, user_id: state.userId, vote_type: 'in' },
        { onConflict: 'location_id,user_id' }
      )
      .then(({ error }) => {
        if (error) {
          console.error("Error persisting vote:", error);
          // Rollback (reverse the optimistic update)
        }
      });
  }
},
```

**Step 5: Implement voteNotHere** — mirror of voteIn but with 'not_here'.

**Step 6: Implement removeVote** — DELETE from pp_votes, decrement appropriate counter.

**Step 7: Implement loadLocationVoters**

```typescript
loadLocationVoters: async (locationIds) => {
  if (!isSupabaseConfigured || !supabase || locationIds.length === 0) return;
  const { data, error } = await supabase.rpc('get_location_voters', {
    location_ids: locationIds,
  });
  if (error) { console.error(error); return; }
  const voterMap = new Map<string, VoterInfo[]>();
  for (const row of data || []) {
    const list = voterMap.get(row.location_id) || [];
    list.push({
      userId: row.user_id,
      voteType: row.vote_type as VoteType,
      displayName: row.display_name,
      email: row.email,
    });
    voterMap.set(row.location_id, list);
  }
  set({ locationVoters: voterMap });
},
```

**Step 8: Implement setSortMode** — `set({ sortMode: mode })`

**Step 9: Keep existing vote/unvote actions unchanged** — admin UI still uses them.

**Step 10: Commit** — `git commit -m "feat: store support for vote types, voter loading, sort mode"`

---

## Task 6: AvatarRow Component

**Files:**
- Create: `src/components/AvatarRow.tsx`

**Step 1: Build AvatarRow**

```tsx
"use client";

import { VoterInfo } from "@/types";

function getInitials(voter: VoterInfo): string {
  if (voter.displayName) {
    const parts = voter.displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return voter.email[0].toUpperCase();
}

const COLORS = [
  "bg-gray-800 text-white",
  "bg-amber-600 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
];

interface AvatarRowProps {
  voters: VoterInfo[];
  maxDisplay?: number;
}

export function AvatarRow({ voters, maxDisplay = 4 }: AvatarRowProps) {
  const inVoters = voters.filter(v => v.voteType === 'in');
  const displayed = inVoters.slice(0, maxDisplay);
  const overflow = inVoters.length - maxDisplay;

  if (displayed.length === 0) return null;

  return (
    <div className="flex items-center">
      {displayed.map((voter, i) => (
        <div
          key={voter.userId}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${COLORS[i % COLORS.length]} ${i > 0 ? '-ml-1.5' : ''} ring-2 ring-white`}
        >
          {getInitials(voter)}
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1.5 text-xs text-gray-500">+{overflow}</span>
      )}
    </div>
  );
}
```

**Step 2: Commit** — `git commit -m "feat: AvatarRow component"`

---

## Task 7: AltLocationCard Component

**Files:**
- Create: `src/components/AltLocationCard.tsx`

**Step 1: Build the card**

Key elements from mockup:
- Location name (use `name` field which is now set to address) + distance
- Status badge: "Ready to go" (GREEN), "Needs work" (YELLOW/AMBER), "Challenging" (RED)
- AvatarRow + stats line: "20 in · 1 concern · 10 more to launch"
- Vote buttons: "I'm in" (dark filled) / "Not here" (outline) — or "You're in" checkmark

```tsx
"use client";

import { Location, VoterInfo } from "@/types";
import { AvatarRow } from "./AvatarRow";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { extractStreet } from "@/lib/address";

const LAUNCH_THRESHOLD = 30;

function statusBadge(overallColor: string | null | undefined) {
  if (overallColor === "GREEN") return { label: "Ready to go", className: "text-green-700" };
  if (overallColor === "YELLOW" || overallColor === "AMBER") return { label: "Needs work", className: "text-amber-600" };
  if (overallColor === "RED") return { label: "Challenging", className: "text-red-600" };
  return null;
}

interface AltLocationCardProps {
  location: Location;
  distance?: number;           // miles from map center
  voters: VoterInfo[];
  hasVotedIn: boolean;
  hasVotedNotHere: boolean;
  isAuthenticated: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onVoteIn: () => void;
  onVoteNotHere: () => void;
}

export function AltLocationCard({
  location, distance, voters, hasVotedIn, hasVotedNotHere,
  isAuthenticated, isSelected, onSelect, onVoteIn, onVoteNotHere,
}: AltLocationCardProps) {
  const badge = statusBadge(location.scores?.overallColor);
  const remaining = Math.max(0, LAUNCH_THRESHOLD - location.votes);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected ? "border-gray-900 shadow-md" : "border-gray-200",
      )}
    >
      {/* Row 1: Name + distance */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[15px] leading-tight">
          {extractStreet(location.address, location.city)}
        </h3>
      </div>
      {distance != null && (
        <p className="text-xs text-gray-500 mt-0.5">{distance.toFixed(1)} mi from you</p>
      )}

      {/* Status badge */}
      {badge && (
        <p className={cn("text-xs font-medium mt-1.5", badge.className)}>
          &#10003; {badge.label}
        </p>
      )}

      {/* Avatar row + stats */}
      <div className="flex items-center gap-2 mt-2">
        <AvatarRow voters={voters} />
        <span className="text-xs text-gray-600">
          <strong>{location.votes}</strong> in
          {location.notHereVotes > 0 && (
            <> · <span className="text-amber-600">{location.notHereVotes} concern{location.notHereVotes !== 1 ? 's' : ''}</span></>
          )}
          {remaining > 0 && (
            <> · <span className="text-gray-400">{remaining} more to launch</span></>
          )}
        </span>
      </div>

      {/* Vote buttons */}
      <div className="flex gap-2 mt-3">
        {hasVotedIn ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium py-2">
            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            You&apos;re in
          </div>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onVoteIn(); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                "bg-gray-900 text-white hover:bg-gray-800"
              )}
            >
              I&apos;m in
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onVoteNotHere(); }}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                hasVotedNotHere
                  ? "border-gray-400 bg-gray-100 text-gray-500"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              Not here
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit** — `git commit -m "feat: AltLocationCard component"`

---

## Task 8: InviteModal Component + API Route

**Files:**
- Create: `src/components/InviteModal.tsx`
- Create: `src/app/api/invite/route.ts`
- Modify: `src/lib/email.ts` (add invite email template)

**Step 1: Add invite email template to email.ts**

```typescript
export function generateInviteHtml(inviterName: string): string {
  return `
    <h2>${inviterName} invited you to help choose a school location</h2>
    <p>Alpha School is opening new micro schools, and families are choosing where. ${inviterName} thinks you'd want to be part of it.</p>
    <p><strong>What Alpha Feels Like:</strong> Two hours of focused academics. Then the rest of the day building real things — businesses, robots, films, friendships.</p>
    <div style="margin-top:24px;">
      <a href="https://parentpicker.vercel.app" style="display:inline-block;padding:14px 28px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See Locations Near You</a>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">Say "I'm in" on locations you like. Enough families, and it happens.</p>
  `;
}
```

**Step 2: Create API route `src/app/api/invite/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, generateInviteHtml } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Get inviter name from profile or email
  const { data: profile } = await supabaseAdmin
    .from("pp_profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();
  const inviterName = profile?.display_name || profile?.email?.split("@")[0] || "A parent";

  // Record the invite
  await supabaseAdmin.from("pp_invites").insert({
    inviter_id: user.id,
    invitee_email: email,
  });

  // Send email
  const html = generateInviteHtml(inviterName);
  const result = await sendEmail(email, `${inviterName} invited you to Alpha School`, html);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Build InviteModal component**

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";

export function InviteModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { session } = useAuth();

  const [showSignIn, setShowSignIn] = useState(false);

  const handleOpen = () => {
    if (!session) { setShowSignIn(true); return; }
    setOpen(true);
  };

  const handleSend = async () => {
    if (!email.trim() || !session) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send");
      } else {
        setSent(true);
        setEmail("");
        setTimeout(() => { setOpen(false); setSent(false); }, 2000);
      }
    } catch {
      setError("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full py-3 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <span>👋</span> Invite a family
      </button>

      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Sign in to invite</DialogTitle></DialogHeader>
          <SignInPrompt
            title="Sign in first"
            description="Enter your email to receive a magic link."
          />
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a family</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter their email address"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sent ? (
              <p className="text-sm text-green-600 font-medium">Invite sent!</p>
            ) : (
              <Button onClick={handleSend} disabled={sending || !email.trim()} className="w-full">
                {sending ? "Sending..." : "Send invite"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 4: Commit** — `git commit -m "feat: invite-a-family modal, API route, email template"`

---

## Task 9: AltPanel Component

**Files:**
- Create: `src/components/AltPanel.tsx`

**Step 1: Build the full panel**

This is the main assembly component. It replaces `LocationsList` for non-admin users.

```tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useVotesStore } from "@/lib/votes";
import { useShallow } from "zustand/react/shallow";
import { useAuth } from "./AuthProvider";
import { AltLocationCard } from "./AltLocationCard";
import { InviteModal } from "./InviteModal";
import { AuthButton } from "./AuthButton";
import { getDistanceMiles } from "@/lib/locations";
import { Location } from "@/types";

const COLOR_RANK: Record<string, number> = { GREEN: 0, YELLOW: 1, AMBER: 2, RED: 3 };

function sortMostSupport(a: Location, b: Location): number {
  if (b.votes !== a.votes) return b.votes - a.votes;
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  return aRank - bRank;
}

function sortMostViable(a: Location, b: Location): number {
  const aRank = COLOR_RANK[a.scores?.overallColor || ""] ?? 99;
  const bRank = COLOR_RANK[b.scores?.overallColor || ""] ?? 99;
  if (aRank !== bRank) return aRank - bRank;
  return b.votes - a.votes;
}

export function AltPanel() {
  // Pull state from store
  const {
    filteredLocations, selectedLocationId, setSelectedLocation,
    voteIn, voteNotHere, votedLocationIds, votedNotHereIds,
    mapCenter, mapBounds, sortMode, setSortMode,
    locationVoters, loadLocationVoters, zoomLevel, citySummaries,
  } = useVotesStore(useShallow(s => ({
    filteredLocations: s.filteredLocations,
    selectedLocationId: s.selectedLocationId,
    setSelectedLocation: s.setSelectedLocation,
    voteIn: s.voteIn,
    voteNotHere: s.voteNotHere,
    votedLocationIds: s.votedLocationIds,
    votedNotHereIds: s.votedNotHereIds,
    mapCenter: s.mapCenter,
    mapBounds: s.mapBounds,
    sortMode: s.sortMode,
    setSortMode: s.setSortMode,
    locationVoters: s.locationVoters,
    loadLocationVoters: s.loadLocationVoters,
    zoomLevel: s.zoomLevel,
    citySummaries: s.citySummaries,
  })));

  const { isAuthenticated } = useAuth();

  // Determine metro name when zoomed in
  const metroName = useMemo(() => {
    if (zoomLevel < 9) return null;
    // Find the city from the most common city in filtered locations
    const filtered = filteredLocations();
    if (filtered.length === 0) return null;
    const cityCount: Record<string, number> = {};
    for (const loc of filtered) {
      const key = `${loc.city}, ${loc.state}`;
      cityCount[key] = (cityCount[key] || 0) + 1;
    }
    const top = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0].split(",")[0].trim() : null;
  }, [zoomLevel, filteredLocations]);

  // Sort and filter locations in viewport
  const sortedLocations = useMemo(() => {
    const filtered = filteredLocations();
    if (!mapBounds) return filtered;
    const inView = filtered.filter(loc =>
      loc.lat <= mapBounds.north && loc.lat >= mapBounds.south &&
      loc.lng <= mapBounds.east && loc.lng >= mapBounds.west
    );
    const sortFn = sortMode === 'most_support' ? sortMostSupport : sortMostViable;
    return [...inView].sort(sortFn);
  }, [filteredLocations, mapBounds, sortMode]);

  // Load voter details for visible cards
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const visibleLocations = sortedLocations.slice(0, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    const ids = visibleLocations.map(l => l.id);
    if (ids.length > 0) loadLocationVoters(ids);
  }, [visibleLocations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        {/* Metro label */}
        {metroName && (
          <p className="text-xs font-semibold text-blue-600 tracking-wide mb-1">
            ALPHA SCHOOL &middot; {metroName.toUpperCase()}
          </p>
        )}

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Choose where your kid goes to school.
          </h1>
          <AuthButton />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Say &ldquo;I&rsquo;m in.&rdquo; Share what you know. Enough families, and it happens.
        </p>
      </div>

      {/* What Alpha Feels Like card */}
      <div className="mx-5 mb-4 bg-gray-900 rounded-xl p-5 text-white">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 mb-2">
          WHAT ALPHA FEELS LIKE
        </p>
        <p className="text-[15px] leading-snug">
          Two hours of focused academics. Then the rest of the day building real things — businesses, robots, films, friendships.
        </p>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-gray-800 rounded-lg p-3">
            <p className="text-lg font-bold">2 hrs</p>
            <p className="text-[10px] text-gray-400">AI-powered academics</p>
          </div>
          <div className="flex-1 bg-gray-800 rounded-lg p-3">
            <p className="text-lg font-bold">2&times;</p>
            <p className="text-[10px] text-gray-400">the learning, measured</p>
          </div>
          <div className="flex-1 bg-gray-800 rounded-lg p-3">
            <p className="text-lg font-bold">100%</p>
            <p className="text-[10px] text-gray-400">of kids say they love school</p>
          </div>
        </div>
        <div className="mt-4">
          <InviteModal />
        </div>
      </div>

      {/* Sort pills */}
      <div className="px-5 pb-3 flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort</span>
        {(['most_support', 'most_viable'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortMode === mode
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {mode === 'most_support' ? 'Most support' : 'Most viable'}
          </button>
        ))}
      </div>

      {/* Location cards */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
        {visibleLocations.map(loc => (
          <AltLocationCard
            key={loc.id}
            location={loc}
            distance={mapCenter ? getDistanceMiles(mapCenter.lat, mapCenter.lng, loc.lat, loc.lng) : undefined}
            voters={locationVoters.get(loc.id) || []}
            hasVotedIn={votedLocationIds.has(loc.id)}
            hasVotedNotHere={votedNotHereIds.has(loc.id)}
            isAuthenticated={isAuthenticated}
            isSelected={selectedLocationId === loc.id}
            onSelect={() => setSelectedLocation(loc.id)}
            onVoteIn={() => voteIn(loc.id)}
            onVoteNotHere={() => voteNotHere(loc.id)}
          />
        ))}
        {sortedLocations.length > visibleLocations.length && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="w-full py-2 text-sm text-blue-600 font-medium hover:underline"
          >
            Show more locations
          </button>
        )}
        {visibleLocations.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No locations in this area yet. Zoom out or search a different city.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit** — `git commit -m "feat: AltPanel component — full left panel assembly"`

---

## Task 10: Wire AltPanel into page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import AltPanel and swap based on admin status**

Replace `<LocationsList />` with conditional rendering:
- Admin users: existing `<LocationsList />` (unchanged)
- Non-admin users: `<AltPanel />`

In the desktop sidebar section (around line 154):
```tsx
<div className="flex-1 bg-white overflow-hidden flex flex-col">
  {isAdmin ? <LocationsList /> : <AltPanel />}
</div>
```

Same in the mobile expanded panel (around line 228):
```tsx
<div className="flex-1 overflow-hidden">
  {isAdmin ? <LocationsList /> : <AltPanel />}
</div>
```

For non-admin mobile collapsed state, replace the existing header/bullets with a trimmed version of the AltPanel hero.

**Step 2: Update desktop panel styling for non-admin**

The current desktop panel has `bg-blue-600` header. For non-admin, the AltPanel has its own white background — so the outer wrapper should adapt:
```tsx
<div className={cn(
  "hidden lg:flex flex-col absolute top-4 left-4 bottom-4 w-[380px] rounded-xl shadow-2xl overflow-hidden",
  isAdmin ? "bg-blue-600" : "bg-white"
)}>
  {isAdmin ? (
    <>
      {/* existing header JSX */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        <LocationsList />
      </div>
    </>
  ) : (
    <AltPanel />
  )}
</div>
```

**Step 3: Commit** — `git commit -m "feat: wire AltPanel into page.tsx, admin/parent panel swap"`

---

## Task 11: Auth Flow for Voting

**Files:**
- Modify: `src/components/AltLocationCard.tsx`

**Step 1: Add sign-in prompt for unauthenticated voters**

The "I'm in" and "Not here" buttons need to show a sign-in dialog when clicked by unauthenticated users. Add `SignInPrompt` dialog to `AltLocationCard`:

```tsx
const [showSignIn, setShowSignIn] = useState(false);

const handleVoteIn = () => {
  if (!isAuthenticated) { setShowSignIn(true); return; }
  onVoteIn();
};

const handleVoteNotHere = () => {
  if (!isAuthenticated) { setShowSignIn(true); return; }
  onVoteNotHere();
};
```

Add the Dialog JSX at the bottom of the component, matching the pattern in `VoteButton.tsx`.

**Step 2: Commit** — `git commit -m "feat: auth flow for alt voting buttons"`

---

## Task 12: Smoke Test + Deploy

**Step 1: Run `npm run build`** — fix any type errors or missing imports.

**Step 2: Run `npm run dev`** — manually verify:
- Non-admin sees AltPanel with hero, dark card, sort pills, location cards
- "I'm in" / "Not here" buttons work (persist to DB)
- Avatar row shows voter initials
- Sort toggle switches between most support / most viable
- Invite modal captures email and sends
- Admin still sees old LocationsList

**Step 3: Deploy** — `npx vercel --prod`

**Step 4: Commit any fixes** — `git commit -m "fix: smoke test fixes for alt-ui"`

---

## Dependency Order

```
Task 1 (DB: vote_type) → Task 4 (Types) → Task 5 (Store)
Task 2 (DB: invites) → Task 8 (InviteModal + API)
Task 3 (DB: voters RPC) → Task 5 (Store)
Task 5 (Store) → Task 7 (AltLocationCard) → Task 9 (AltPanel) → Task 10 (Wire up)
Task 6 (AvatarRow) → Task 7 (AltLocationCard)
Task 11 (Auth) after Task 7
Task 12 (Smoke test) last

Tasks 1, 2, 3 can run in parallel.
Tasks 6, 8 can run in parallel with 4/5.
```
