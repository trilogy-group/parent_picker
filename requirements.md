# Parent Picker - Requirements Document

## Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input to inform site selection decisions.

**Reference Implementation:** https://sportsacademy.school/map/facilities

---

## Business Requirements

> **Note:** These are high-level strategic requirements that guide product decisions. They do not have automated test cases as they represent business goals rather than testable functionality.

### BIZ-1: Leverage Parent Network for Site Discovery
Alpha parents are highly connected in their communities. This application leverages that network to crowdsource potential school locations, reducing the burden on the real estate team and surfacing locations with built-in community support.

### BIZ-2: Validate Demand Before Investment
By allowing parents to vote on locations, the business can gauge demand before committing resources to site evaluation, zoning research, or lease negotiations. High vote counts indicate strong community interest.

### BIZ-3: Scale Location Sourcing
Traditional real estate sourcing doesn't scale to hundreds/thousands of locations. This tool enables parallel, community-driven location discovery across multiple markets simultaneously.

### BIZ-4: Hyper-Local Real Estate Intelligence
Real estate expertise (zoning, permitting, community dynamics) is hyper-local. Parent suggestions come with implicit local knowledge that would be expensive to acquire through traditional research.

### BIZ-5: Build Community Engagement Early
Engaging parents in the site selection process builds investment in the school before it opens. Parents who voted for a location are more likely to enroll and evangelize.

### BIZ-6: Reduce Time-to-Open
By pre-qualifying locations through community voting, the business can focus due diligence on high-probability sites, reducing the overall time from market entry decision to school opening.

### BIZ-7: Data-Driven Expansion Decisions
Aggregated voting data provides quantitative input for expansion planning, helping prioritize markets and neighborhoods based on demonstrated parent interest rather than assumptions.

---

## 1. Layout & Structure

### REQ-1.1: Full-Screen Map Background
The application displays a full-screen interactive map as the primary background.

**Test Cases:**
- [ ] `TC-1.1.1`: Map canvas fills 100% of viewport width and height
- [ ] `TC-1.1.2`: Map is interactive (pan, zoom enabled)
- [ ] `TC-1.1.3`: Map loads within 3 seconds on broadband connection

### REQ-1.2: Desktop Overlay Panel
On desktop (≥1024px), a blue overlay panel appears on the left side of the screen.

**Test Cases:**
- [ ] `TC-1.2.1`: Panel is visible at viewport width ≥1024px
- [ ] `TC-1.2.2`: Panel has blue background (bg-blue-600)
- [ ] `TC-1.2.3`: Panel is positioned absolute, top-4 left-4 bottom-4
- [ ] `TC-1.2.4`: Panel width is 380px
- [ ] `TC-1.2.5`: Panel has rounded corners (rounded-xl) and shadow

### REQ-1.3: Mobile Bottom Sheet
On mobile (<1024px), a bottom sheet replaces the overlay panel.

**Test Cases:**
- [ ] `TC-1.3.1`: Bottom sheet is visible at viewport width <1024px
- [ ] `TC-1.3.2`: Bottom sheet has pull handle (gray rounded bar)
- [ ] `TC-1.3.3`: Bottom sheet can be expanded/collapsed by tapping handle
- [ ] `TC-1.3.4`: Collapsed state shows title, vote count, and suggest button
- [ ] `TC-1.3.5`: Expanded state shows full locations list with filters

---

## 2. Header & Branding

### REQ-2.1: Application Title
The panel header displays the application title "Alpha School Locations".

**Test Cases:**
- [ ] `TC-2.1.1`: Title text "Alpha School Locations" is visible in panel header
- [ ] `TC-2.1.2`: Title has location pin icon
- [ ] `TC-2.1.3`: Title is white text on blue background

### REQ-2.2: Tagline
A descriptive tagline appears below the title.

**Test Cases:**
- [ ] `TC-2.2.1`: Tagline "Find & vote on micro school sites" is visible
- [ ] `TC-2.2.2`: Tagline is lighter blue text (blue-100)

### REQ-2.3: Vote Statistics
The panel displays total vote count from all locations.

**Test Cases:**
- [ ] `TC-2.3.1`: Vote count displays as "[number] Votes from Parents"
- [ ] `TC-2.3.2`: Vote count updates dynamically when votes are cast
- [ ] `TC-2.3.3`: Count includes icon (people/users icon)

---

## 3. Map Functionality

### REQ-3.1: Map Provider
The map uses Mapbox GL JS via react-map-gl.

**Test Cases:**
- [ ] `TC-3.1.1`: Map renders using Mapbox streets-v12 style
- [ ] `TC-3.1.2`: Map displays Mapbox attribution
- [ ] `TC-3.1.3`: Map handles missing API token gracefully with error message

### REQ-3.2: Default View
The map starts at a US-wide view (zoom 4) and flies to the user's geolocation if permission is granted.

**Test Cases:**
- [ ] `TC-3.2.1`: Initial view shows US-wide (zoom ~4) before geolocation resolves
- [ ] `TC-3.2.2`: Map flies to user geolocation if permission granted
- [ ] `TC-3.2.3`: Navigation controls (zoom +/-) are visible top-right

### REQ-3.3: Location Markers
Each location displays as a circular marker on the map.

**Test Cases:**
- [ ] `TC-3.3.1`: Each location has a visible marker
- [ ] `TC-3.3.2`: Default markers are dark gray (slate-600) circles
- [ ] `TC-3.3.3`: Selected marker is blue (blue-600)
- [ ] `TC-3.3.4`: Suggested location markers are amber (amber-500)
- [ ] `TC-3.3.5`: Markers have white border and shadow
- [ ] `TC-3.3.6`: Markers scale up on hover (1.25x)
- [ ] `TC-3.3.7`: Selected marker scales up (1.5x)

### REQ-3.4: Marker Interaction
Clicking a marker selects that location.

**Test Cases:**
- [ ] `TC-3.4.1`: Clicking marker selects the location
- [ ] `TC-3.4.2`: Clicking marker highlights corresponding list item
- [ ] `TC-3.4.3`: Clicking map background deselects current selection

### REQ-3.5: Map Animation
Selecting a location animates the map to center on it.

**Test Cases:**
- [ ] `TC-3.5.1`: Map flies to selected location coordinates
- [ ] `TC-3.5.2`: Animation duration is ~1 second
- [ ] `TC-3.5.3`: Zoom level changes to 14 when flying to location

---

## 4. Locations List

### REQ-4.1: List Container
The locations list appears in the white section of the overlay panel.

**Test Cases:**
- [ ] `TC-4.1.1`: List has white background
- [ ] `TC-4.1.2`: List is scrollable when content overflows
- [ ] `TC-4.1.3`: List fills remaining panel height below header sections

### REQ-4.2: Score & Size Filters
A collapsible filter panel allows filtering locations by score color and size tier. The search bar has been removed — filters are the only way to narrow down locations.

**Business Logic:**
- 5 score categories: Overall, Price, Regulatory, Neighborhood, Building — each with G/Y/R color chip toggles
- Size tier buttons: Micro, Micro2, Growth, Full Size, N/A (Red Reject)
- AND logic across categories, OR within a category (e.g., GREEN OR YELLOW overall AND GREEN price)
- Red (Reject) size is excluded by default; 4 non-reject sizes selected by default
- Filters cascade to both list and map (via `filteredLocations()` in Zustand store)

**Test Cases:**
- [ ] `TC-4.2.1`: Collapsible "Filters" button is visible in list panel
- [ ] `TC-4.2.2`: Clicking "Filters" expands the filter panel
- [ ] `TC-4.2.3`: Filter panel shows 5 score categories (Overall, Price, Regulatory, Neighborhood, Building)
- [ ] `TC-4.2.4`: Each score category has G/Y/R color chip toggles
- [ ] `TC-4.2.5`: Size filter shows Micro, Micro2, Growth, Full, N/A buttons
- [ ] `TC-4.2.6`: Empty results show "No locations found" message
- [ ] `TC-4.2.7`: Clicking a color chip toggles it on/off
- [ ] `TC-4.2.8`: Active filter count badge shown when filters are active
- [ ] `TC-4.2.9`: "Clear" button resets all filters to defaults
- [ ] `TC-4.2.10`: Red (Reject) size excluded by default
- [ ] `TC-4.2.11`: Filters apply to map markers (filtered locations only)
- [ ] `TC-4.2.12`: Filters reset pagination to page 1

### REQ-4.3: Location Cards
Each location displays as a card in the list.

**Test Cases:**
- [ ] `TC-4.3.1`: Card shows location name (bold)
- [ ] `TC-4.3.2`: Card shows street address with pin icon
- [ ] `TC-4.3.3`: Card shows city and state
- [ ] `TC-4.3.4`: Card shows vote count with heart icon
- [ ] `TC-4.3.5`: Cards are sorted by vote count (descending)
- [ ] `TC-4.3.6`: Suggested locations show "Parent Suggested" badge (amber)

### REQ-4.4: Card Selection
Clicking a card selects that location.

**Test Cases:**
- [ ] `TC-4.4.1`: Clicking card selects the location
- [ ] `TC-4.4.2`: Selected card has ring highlight (ring-2 ring-primary)
- [ ] `TC-4.4.3`: Selected card has elevated shadow
- [ ] `TC-4.4.4`: Clicking card centers map on that location

### REQ-4.5: On-Screen Location List
The locations list shows only locations visible in the current map viewport, sorted by votes then distance.

**Business Logic:**
- Only locations within the current map viewport bounds are shown in the list
- Locations are sorted by vote count (descending), then by distance from map center (ascending) as tiebreaker
- As users pan/zoom the map, the list updates to show only visible locations
- Off-screen locations are not shown (no "beyond viewport" section)

**Test Cases:**
- [ ] `TC-4.5.1`: Only on-screen locations appear in the list
- [ ] `TC-4.5.2`: Locations are sorted by vote count (highest first)
- [ ] `TC-4.5.3`: Distance from map center is tiebreaker for equal votes
- [ ] `TC-4.5.5`: List updates when user pans map
- [ ] `TC-4.5.6`: List updates when user zooms map
- [ ] `TC-4.5.7`: List is sorted by votes then distance on initial load

---

## 5. Voting System

### REQ-5.1: Vote Button
Each location card has a vote button.

**Test Cases:**
- [ ] `TC-5.1.1`: Vote button displays heart icon
- [ ] `TC-5.1.2`: Vote button displays current vote count
- [ ] `TC-5.1.3`: Vote button is clickable without selecting the card

### REQ-5.2: Vote Action
Clicking the vote button toggles the user's vote.

**Test Cases:**
- [ ] `TC-5.2.1`: Clicking vote on unvoted location increments count by 1
- [ ] `TC-5.2.2`: Voted locations show filled heart icon (red)
- [ ] `TC-5.2.3`: Clicking voted location decrements count by 1 (unvote)
- [ ] `TC-5.2.4`: Unvoted locations show outline heart icon
- [ ] `TC-5.2.5`: Vote state persists during session
- [ ] `TC-5.2.6`: Users can vote on multiple locations

### REQ-5.3: Vote Feedback
Voting provides immediate visual feedback.

**Test Cases:**
- [ ] `TC-5.3.1`: Count updates immediately (optimistic UI)
- [ ] `TC-5.3.2`: Heart icon animates/changes on vote
- [ ] `TC-5.3.3`: Total votes in header updates when voting

---

## 6. Suggest Location

### REQ-6.1: Suggest Button
A suggest button appears below the "How It Works" section in the blue panel header area.

**Test Cases:**
- [ ] `TC-6.1.1`: Button text contains "Suggest" (e.g. "+ Or Suggest New Location")
- [ ] `TC-6.1.2`: Button has plus icon
- [ ] `TC-6.1.3`: Button is amber/yellow colored (bg-amber-400)
- [ ] `TC-6.1.4`: Button is visible in panel (desktop) and bottom sheet (mobile)

### REQ-6.2: Suggest Page Navigation
Clicking the suggest button navigates to the `/suggest` full-page form.

**Test Cases:**
- [ ] `TC-6.2.1`: Suggest button links to /suggest page
- [ ] `TC-6.2.2`: /suggest page has title "Suggest a New Location"
- [ ] `TC-6.2.3`: /suggest page has "Back to Map" link

### REQ-6.3: Suggest Form
The `/suggest` page contains a form for location details.

**Test Cases:**
- [ ] `TC-6.3.1`: Form has Street Address field (required)
- [ ] `TC-6.3.2`: Form has City field (required)
- [ ] `TC-6.3.3`: Form has State field (required, 2 char max)
- [ ] `TC-6.3.4`: Form has Notes field (optional)
- [ ] `TC-6.3.5`: Form has Back to Map link
- [ ] `TC-6.3.6`: Form has Submit button
- [ ] `TC-6.3.7`: Submit is disabled while submitting

### REQ-6.4: Suggest Submission
Submitting the form adds a new suggested location and shows success state.

**Test Cases:**
- [ ] `TC-6.4.1`: Valid submission shows success message
- [ ] `TC-6.4.2`: Success state has "Parent Suggested" or confirmation text
- [ ] `TC-6.4.3`: New location appears on map with amber marker
- [ ] `TC-6.4.4`: Map centers on new location after submission
- [ ] `TC-6.4.5`: Form fields are cleared after successful submission
- [ ] `TC-6.4.6`: Invalid submission (empty required fields) shows validation

---

## 7. How It Works Section

### REQ-7.1: Instructions Display
The panel displays usage instructions.

**Test Cases:**
- [ ] `TC-7.1.1`: "How It Works" heading is visible
- [ ] `TC-7.1.2`: Three numbered steps are displayed
- [ ] `TC-7.1.3`: Steps have numbered circles (1, 2, 3)
- [ ] `TC-7.1.4`: Step text is readable (blue-100 on blue background)

---

## 8. Responsive Design

### REQ-8.1: Desktop Layout (≥1024px)
Desktop displays overlay panel on left with full-screen map.

**Test Cases:**
- [ ] `TC-8.1.1`: Overlay panel visible at 1024px width
- [ ] `TC-8.1.2`: Overlay panel visible at 1440px width
- [ ] `TC-8.1.3`: Bottom sheet hidden on desktop

### REQ-8.2: Mobile Layout (<1024px)
Mobile displays bottom sheet over full-screen map.

**Test Cases:**
- [ ] `TC-8.2.1`: Bottom sheet visible at 375px width (iPhone)
- [ ] `TC-8.2.2`: Bottom sheet visible at 768px width (tablet)
- [ ] `TC-8.2.3`: Overlay panel hidden on mobile
- [ ] `TC-8.2.4`: Map fills entire screen behind bottom sheet

### REQ-8.3: Touch Interactions
Mobile supports touch gestures.

**Test Cases:**
- [ ] `TC-8.3.1`: Map supports pinch-to-zoom
- [ ] `TC-8.3.2`: Map supports touch-drag-pan
- [ ] `TC-8.3.3`: Tap on marker selects location
- [ ] `TC-8.3.4`: Bottom sheet responds to tap on handle

---

## 9. Data Layer

### REQ-9.1: Location Data Model
Locations have a defined data structure.

**Test Cases:**
- [ ] `TC-9.1.1`: Location has id (string, unique)
- [ ] `TC-9.1.2`: Location has name (string)
- [ ] `TC-9.1.3`: Location has address (string)
- [ ] `TC-9.1.4`: Location has city (string)
- [ ] `TC-9.1.5`: Location has state (string)
- [ ] `TC-9.1.6`: Location has lat (number)
- [ ] `TC-9.1.7`: Location has lng (number)
- [ ] `TC-9.1.8`: Location has votes (number, ≥0)
- [ ] `TC-9.1.9`: Location has suggested (boolean, optional)

### REQ-9.2: Supabase Data Layer
Primary data source is Supabase (pp_locations, pp_votes, pp_listings tables). Mock data provides offline fallback when Supabase env vars are not configured.

**Test Cases:**
- [ ] `TC-9.2.1`: App loads locations from Supabase pp_locations_with_votes view
- [ ] `TC-9.2.2`: App falls back to mock data when Supabase is not configured
- [ ] `TC-9.2.3`: Mock fallback loads with at least 5 locations with varied vote counts
- [ ] `TC-9.2.4`: Supabase fetch paginates with .range() to retrieve all rows beyond PostgREST 1000-row limit
- [ ] `TC-9.2.5`: All parent-suggested locations (0 votes) are included in results regardless of total count

### REQ-9.3: State Management
Application state is managed with Zustand.

**Test Cases:**
- [ ] `TC-9.3.1`: Locations state is accessible globally
- [ ] `TC-9.3.2`: Selected location state syncs between map and list
- [ ] `TC-9.3.3`: Voted locations state persists during session
- [ ] `TC-9.3.4`: Search query state filters locations reactively

---

## 10. Performance

### REQ-10.1: Initial Load
The application loads quickly.

**Test Cases:**
- [ ] `TC-10.1.1`: First Contentful Paint < 2 seconds
- [ ] `TC-10.1.2`: Time to Interactive < 4 seconds
- [ ] `TC-10.1.3`: Map tiles begin loading within 3 seconds

### REQ-10.2: Runtime Performance
The application performs smoothly during use.

**Test Cases:**
- [ ] `TC-10.2.1`: Map pan/zoom is 60fps smooth
- [ ] `TC-10.2.2`: List scrolling is smooth
- [ ] `TC-10.2.3`: Search filtering responds within 100ms
- [ ] `TC-10.2.4`: Vote updates reflect within 50ms

---

## 11. Accessibility

### REQ-11.1: Keyboard Navigation
The application is keyboard accessible.

**Test Cases:**
- [ ] `TC-11.1.1`: All interactive elements are focusable via Tab
- [ ] `TC-11.1.2`: Focus order is logical (top to bottom, left to right)
- [ ] `TC-11.1.3`: Modal can be closed with Escape key
- [ ] `TC-11.1.4`: Buttons activate with Enter/Space

### REQ-11.2: Screen Reader Support
The application works with screen readers.

**Test Cases:**
- [ ] `TC-11.2.1`: Map has aria-label="Map"
- [ ] `TC-11.2.2`: Buttons have descriptive text or aria-labels
- [ ] `TC-11.2.3`: Modal has role="dialog"
- [ ] `TC-11.2.4`: Form inputs have associated labels

### REQ-11.3: Visual Accessibility
The application meets visual accessibility standards.

**Test Cases:**
- [ ] `TC-11.3.1`: Text contrast ratio ≥ 4.5:1 (WCAG AA)
- [ ] `TC-11.3.2`: Interactive elements have visible focus states
- [ ] `TC-11.3.3`: Color is not the only means of conveying information

---

## 12. Error Handling

### REQ-12.1: Map Token Missing
The app handles missing Mapbox token gracefully.

**Test Cases:**
- [ ] `TC-12.1.1`: Missing token shows friendly error message
- [ ] `TC-12.1.2`: Error message includes instructions to add token
- [ ] `TC-12.1.3`: App doesn't crash with missing token

### REQ-12.2: Network Errors
The app handles network issues gracefully.

**Test Cases:**
- [ ] `TC-12.2.1`: Map tiles failing to load shows placeholder
- [ ] `TC-12.2.2`: Vote submission errors don't lose user's vote intent

---

## 13. Environment & Configuration

### REQ-13.1: Environment Variables
Sensitive configuration is stored in environment variables.

**Test Cases:**
- [ ] `TC-13.1.1`: NEXT_PUBLIC_MAPBOX_TOKEN is read from .env.local
- [ ] `TC-13.1.2`: .env.local is in .gitignore
- [ ] `TC-13.1.3`: App provides .env.local template or documentation

---

## 14. Tech Stack Requirements

### REQ-14.1: Framework
Built with Next.js 15+ using App Router.

**Test Cases:**
- [ ] `TC-14.1.1`: App uses Next.js App Router (src/app directory)
- [ ] `TC-14.1.2`: TypeScript is enabled and strict
- [ ] `TC-14.1.3`: ESLint passes with no errors

### REQ-14.2: Styling
Styled with Tailwind CSS and shadcn/ui.

**Test Cases:**
- [ ] `TC-14.2.1`: Tailwind CSS classes are used throughout
- [ ] `TC-14.2.2`: shadcn/ui components used for Button, Card, Dialog, Input
- [ ] `TC-14.2.3`: Custom styles use Tailwind conventions

### REQ-14.3: Maps
Uses Mapbox GL JS via react-map-gl.

**Test Cases:**
- [ ] `TC-14.3.1`: react-map-gl/mapbox is used for map components
- [ ] `TC-14.3.2`: Map is dynamically imported (SSR disabled)
- [ ] `TC-14.3.3`: mapbox-gl CSS is imported

---

## 15. Address Autocomplete & Geocoding

### REQ-15.1: Address Autocomplete Component
The application provides address autocomplete using Mapbox Geocoding API.

**Test Cases:**
- [ ] `TC-15.1.1`: Typing 3+ characters in address field shows autocomplete dropdown
- [ ] `TC-15.1.2`: Dropdown shows up to 5 address suggestions
- [ ] `TC-15.1.3`: Each suggestion shows full address (street, city, state)
- [ ] `TC-15.1.4`: Clicking a suggestion populates the address field
- [ ] `TC-15.1.5`: Keyboard navigation (up/down arrows) works in dropdown
- [ ] `TC-15.1.6`: Pressing Enter selects highlighted suggestion
- [ ] `TC-15.1.7`: Pressing Escape closes dropdown
- [ ] `TC-15.1.8`: Dropdown closes when clicking outside

### REQ-15.2: Suggest Location Autocomplete
The suggest location modal uses address autocomplete for the address field.

**Test Cases:**
- [ ] `TC-15.2.1`: Street Address field has autocomplete functionality
- [ ] `TC-15.2.2`: Selecting autocomplete suggestion auto-fills city and state
- [ ] `TC-15.2.3`: Submitted location uses geocoded coordinates from Mapbox
- [ ] `TC-15.2.4`: New location marker appears at correct geocoded position

### REQ-15.3: Search Autocomplete
The location search input provides address autocomplete for finding new areas.

**Test Cases:**
- [ ] `TC-15.3.1`: Search input shows autocomplete dropdown when typing addresses
- [ ] `TC-15.3.2`: Selecting an address suggestion centers map on that location
- [ ] `TC-15.3.3`: Search still filters existing locations by name/address/city

### REQ-15.4: Mock Data Accuracy
All mock location coordinates are accurate to their addresses.

**Test Cases:**
- [ ] `TC-15.4.1`: Mock locations display at correct map positions
- [ ] `TC-15.4.2`: Clicking mock location marker centers map on correct address

---

## 16. Authentication

### REQ-16.1: Magic Link Sign-In
Users authenticate via Supabase magic link (passwordless email).

**Test Cases:**
- [ ] `TC-16.1.1`: Sign-in prompt appears when unauthenticated user attempts a gated action
- [ ] `TC-16.1.2`: User can enter email and receive a magic link
- [ ] `TC-16.1.3`: Clicking magic link signs user in and redirects back to app
- [ ] `TC-16.1.4`: Auth state persists across page refreshes (session cookie)

### REQ-16.2: Auth-Gated Actions
Certain actions require authentication.

**Test Cases:**
- [ ] `TC-16.2.1`: Voting requires sign-in
- [ ] `TC-16.2.2`: Suggesting a location requires sign-in
- [ ] `TC-16.2.3`: Unauthenticated users can browse locations and map freely

### REQ-16.3: Persistent Votes
Votes are stored per-user in Supabase with row-level security.

**Test Cases:**
- [ ] `TC-16.3.1`: Votes persist across sessions for authenticated users
- [ ] `TC-16.3.2`: Users can only modify their own votes (RLS enforced)
- [ ] `TC-16.3.3`: Vote counts aggregate across all users

---

## 17. Admin Review Workflow

### REQ-17.1: Admin Access Control
Only designated admin emails can access the admin page. Security is enforced server-side.

**Test Cases:**
- [ ] `TC-17.1.1`: Non-admin user sees "Access Denied" on /admin
- [ ] `TC-17.1.2`: Unauthenticated user sees "Access Denied" on /admin
- [ ] `TC-17.1.3`: Admin user (email in ADMIN_EMAILS) can access /admin
- [ ] `TC-17.1.4`: API routes return 401 for non-admin requests

### REQ-17.2: Review Queue Display
Admin page shows all locations with `status = 'pending_review'`.

**Test Cases:**
- [ ] `TC-17.2.1`: Pending locations appear in the review queue
- [ ] `TC-17.2.2`: Each card shows location name, address, city/state
- [ ] `TC-17.2.3`: Each card shows suggestor email and submission date
- [ ] `TC-17.2.4`: Parent notes are displayed when present
- [ ] `TC-17.2.5`: Score badges are displayed when scores exist
- [ ] `TC-17.2.6`: Empty state shown when no pending locations

### REQ-17.3: Pull Scores
Admin can pull scores from upstream `real_estate_listings` for a pending location.

**Test Cases:**
- [ ] `TC-17.3.1`: "Pull Scores" button triggers sync for the location's address
- [ ] `TC-17.3.2`: Scores display after successful sync
- [ ] `TC-17.3.3`: "No scores found" message when address not in upstream data
- [ ] `TC-17.3.4`: Pull scores does not affect other locations

### REQ-17.4: Approve Location
Admin can approve a pending location, making it visible to all parents.

**Test Cases:**
- [ ] `TC-17.4.1`: Clicking "Approve" changes location status to `active`
- [ ] `TC-17.4.2`: Approved location appears in the main app map and list
- [ ] `TC-17.4.3`: Card is removed from review queue after approval
- [ ] `TC-17.4.4`: Approval email sent to suggestor (best-effort)
- [ ] `TC-17.4.5`: Location retains scores after approval

### REQ-17.5: Reject Location
Admin can reject a pending location.

**Test Cases:**
- [ ] `TC-17.5.1`: Clicking "Reject" changes location status to `rejected`
- [ ] `TC-17.5.2`: Rejected location does not appear in the main app
- [ ] `TC-17.5.3`: Card is removed from review queue after rejection
- [ ] `TC-17.5.4`: Rejection email sent to suggestor (best-effort)

---

## 18. Score Display

### REQ-18.1: Card Score Display
Scored locations display their overall score as a card background tint and 4 icon-based sub-scores.

**Business Logic:**
- Overall score shown as card background color (green-50/yellow-50/amber-50/red-50), not a badge
- 4 sub-scores displayed as colored dots with icons: Neighborhood (MapPin), Regulatory (Landmark), Building (Building2), Price (DollarSign)
- Demographics sub-score is NOT displayed (only used internally)
- Sub-scores are always visible (no expand/collapse)
- ArtifactLink (external link icon) shown in card header when overall details URL exists
- SizeLabel shown in card header with student counts: Micro (25), Micro2 (50-100), Growth (250), Flagship (1000)
- Rank number (#1, #2, etc.) displayed before street address in each card
- Score legend popup (? icon) explains what each icon means

**Test Cases:**
- [ ] `TC-18.1.1`: Scored location cards have background tint matching overall score color
- [ ] `TC-18.1.2`: Card tint is green-50 for GREEN, yellow-50 for YELLOW, amber-50 for AMBER, red-50 for RED
- [ ] `TC-18.1.3`: Unscored locations have no background tint
- [ ] `TC-18.1.4`: 4 sub-score icons displayed: MapPin, Landmark, Building2, DollarSign
- [ ] `TC-18.1.5`: Each sub-score has a colored dot (green/yellow/red/gray)
- [ ] `TC-18.1.6`: Score legend popup opens on ? icon click
- [ ] `TC-18.1.7`: ArtifactLink (ExternalLink icon) shown when overall details URL exists
- [ ] `TC-18.1.8`: SizeLabel shown with student counts: "Micro (25)", "Micro2 (50-100)", "Growth (250)", "Flagship (1000)"
- [ ] `TC-18.1.9`: ArtifactLink opens in new tab and stops click propagation
- [ ] `TC-18.1.10`: Rank number (#1, #2, etc.) shown before street address

### REQ-18.2: Score-Colored Map Markers
Individual location dots on the map are colored by their overall score.

**Test Cases:**
- [ ] `TC-18.2.1`: Dots with GREEN score are green (#22c55e)
- [ ] `TC-18.2.2`: Dots with YELLOW score are yellow (#facc15)
- [ ] `TC-18.2.3`: Dots with AMBER score are amber (#f59e0b)
- [ ] `TC-18.2.4`: Dots with RED score are red (#ef4444)
- [ ] `TC-18.2.5`: Dots with no score are dark gray (#475569)

### REQ-18.3: Map Popup
Selected location popup displays score information matching card layout.

**Test Cases:**
- [ ] `TC-18.3.1`: Popup shows location name, size label, and artifact link
- [ ] `TC-18.3.2`: Popup shows address
- [ ] `TC-18.3.3`: Popup shows sub-scores row with 4 icons
- [ ] `TC-18.3.4`: Popup background tinted by overall score color
- [ ] `TC-18.3.5`: Popup dismissed by clicking dot again
- [ ] `TC-18.3.6`: Popup dismissed by clicking map background
- [ ] `TC-18.3.7`: Popup dismissed by close button

---

## 19. Two-Tier Zoom Model

### REQ-19.1: City Bubbles at Wide Zoom
At zoom < 9, the map shows city-level aggregate bubbles instead of individual markers.

**Test Cases:**
- [ ] `TC-19.1.1`: At zoom < 9, city bubbles are visible on map
- [ ] `TC-19.1.2`: City bubbles show location count as label
- [ ] `TC-19.1.3`: Bubble radius scales with number of locations
- [ ] `TC-19.1.4`: Bubbles have blue fill with white border
- [ ] `TC-19.1.5`: Clicking a city bubble zooms into that city (zoom ~9)
- [ ] `TC-19.1.6`: Overlapping city bubbles cluster together at wide zoom

### REQ-19.2: Individual Dots at City Zoom
At zoom ≥ 9, the map shows individual location dots.

**Test Cases:**
- [ ] `TC-19.2.1`: At zoom ≥ 9, individual dots are visible (not city bubbles)
- [ ] `TC-19.2.2`: Clicking a dot selects that location
- [ ] `TC-19.2.3`: Selected dot opens a popup with name, address, and scores
- [ ] `TC-19.2.4`: At most ~500 nearby dots are fetched (not all 1900)

### REQ-19.3: Transition Between Tiers
Zooming in/out transitions smoothly between city and location views.

**Test Cases:**
- [ ] `TC-19.3.1`: Zooming from <9 to ≥9 switches from bubbles to dots
- [ ] `TC-19.3.2`: Zooming from ≥9 to <9 switches from dots to bubbles

---

## 20. City Summaries List

### REQ-20.1: City Cards at Wide Zoom
When zoom < 9, the panel shows a list of city summary cards instead of individual location cards.

**Test Cases:**
- [ ] `TC-20.1.1`: At zoom < 9, city cards appear in the list (not location cards)
- [ ] `TC-20.1.2`: Each city card shows "City, State" name
- [ ] `TC-20.1.3`: Each city card shows location count (e.g. "760 locations")
- [ ] `TC-20.1.4`: Each city card shows total vote count
- [ ] `TC-20.1.5`: City cards are sorted by total votes descending
- [ ] `TC-20.1.6`: Clicking a city card flies map to that city and fetches nearby locations

---

## 21. Geolocation

### REQ-21.1: Auto-Detect User Location
On load, the app requests browser geolocation and centers the map accordingly.

**Test Cases:**
- [ ] `TC-21.1.1`: Browser geolocation permission is requested on page load
- [ ] `TC-21.1.2`: If granted, map flies to user's location
- [ ] `TC-21.1.3`: If denied, map stays at US-wide view and uses default reference point
- [ ] `TC-21.1.4`: Nearby locations are fetched after geolocation resolves
- [ ] `TC-21.1.5`: Geolocation timeout does not block app load (5-second timeout)

---

## 22. List Pagination

### REQ-22.1: Paginated Location List
The location list displays 25 items per page with a "Next" button.

**Test Cases:**
- [ ] `TC-22.1.1`: At most 25 location cards are shown initially
- [ ] `TC-22.1.2`: "Showing X of Y locations" counter is displayed
- [ ] `TC-22.1.3`: "Next" button appears when more than 25 locations exist
- [ ] `TC-22.1.4`: Clicking "Next" loads 25 more location cards
- [ ] `TC-22.1.5`: Pagination resets when filters change
- [ ] `TC-22.1.6`: Pagination resets when map viewport changes

---

## 23. TODO-Based Parent Assistance Emails

When a parent-suggested location has RED scores (zoning, demographics, or pricing), the approval email includes actionable TODO sections instead of a generic "great news" message.

### REQ-23.1: Zoning TODO
When zoning score is RED, include a zoning TODO in the approval email.

**Test Cases:**
- [ ] `TC-23.1.1`: Zoning TODO generated when `zoning.color === "RED"`
- [ ] `TC-23.1.2`: Zoning TODO includes zone code when available (from `zoning_code` or `lot_zoning`)
- [ ] `TC-23.1.3`: Zoning TODO omits zone code gracefully when none available
- [ ] `TC-23.1.4`: No zoning TODO when zoning score is GREEN/YELLOW/AMBER

### REQ-23.2: Demographics TODO
When demographics score is RED, include a demographics TODO with scenario-specific messaging (M1/M2/M3).

**Test Cases:**
- [ ] `TC-23.2.1`: M1 scenario when metro max enrollment >= 2,500 AND metro max wealth >= 2,500
- [ ] `TC-23.2.2`: M2 scenario when metro max >= 1,000 but < 2,500
- [ ] `TC-23.2.3`: M3 scenario when metro max < 1,000 (requires space donation + 25 students)
- [ ] `TC-23.2.4`: Generic fallback when enrollment/wealth metrics unavailable
- [ ] `TC-23.2.5`: No demographics TODO when demographics score is GREEN/YELLOW/AMBER

### REQ-23.3: Pricing TODO
When pricing score is RED, include a pricing TODO with scenario-specific messaging (P1/P2 or P3).

**Test Cases:**
- [ ] `TC-23.3.1`: P1/P2 scenario when existing Alpha in metro — shows rent negotiation + subsidy table
- [ ] `TC-23.3.2`: P3 scenario when new metro and RED at 25 students — shows launch subsidy + break-even
- [ ] `TC-23.3.3`: Dollar math correct: students = space/100, gap = annual - supportable
- [ ] `TC-23.3.4`: Generic fallback when rent/space data unavailable
- [ ] `TC-23.3.5`: No pricing TODO when pricing score is GREEN/YELLOW/AMBER

### REQ-23.4: Email Integration
TODO emails integrate with existing admin approval workflow.

**Test Cases:**
- [ ] `TC-23.4.1`: Email preview shows TODO sections when RED scores present after pulling scores
- [ ] `TC-23.4.2`: Email preview shows standard approval email when no RED scores
- [ ] `TC-23.4.3`: TODO count badge displayed on admin card after score sync
- [ ] `TC-23.4.4`: Approval email subject changes to "action items inside" when TODOs present
- [ ] `TC-23.4.5`: Sync-scores API returns upstreamMetrics and metroInfo alongside scores

## 24. Admin vs Non-Admin Filters

### REQ-24.1: Admin Filter Panel
The full score filter panel (5 color categories + size + released) is only visible to admin users.

**Test Cases:**
- [ ] `TC-24.1.1`: Admin user sees full filter panel with score categories and size filter
- [ ] `TC-24.1.2`: Non-admin user does not see score category filters
- [ ] `TC-24.1.3`: Non-admin user does not see size filter buttons

### REQ-24.2: Non-Admin Sees All Scored Locations (No Red Toggle)
Non-admin users always see all scored locations including RED. There is no toggle — red locations are shown by default so parents can see the full picture and potentially help with difficult locations.

**Test Cases:**
- [ ] `TC-24.2.1`: Non-admin user sees RED-scored locations in the list
- [ ] `TC-24.2.2`: Non-admin user does NOT see a red toggle or filter controls
- [ ] `TC-24.2.3`: Non-admin sees only scored + released locations (unscored hidden)
- [ ] `TC-24.2.4`: Admin user sees full filter panel (not affected by this change)

### REQ-24.3: Client-Side Admin Detection
Admin status is determined by checking the user's email against NEXT_PUBLIC_ADMIN_EMAILS.

**Test Cases:**
- [ ] `TC-24.3.1`: User with email in NEXT_PUBLIC_ADMIN_EMAILS is treated as admin
- [ ] `TC-24.3.2`: User without email in NEXT_PUBLIC_ADMIN_EMAILS is treated as non-admin
- [ ] `TC-24.3.3`: Unauthenticated user is treated as non-admin
- [ ] `TC-24.3.4`: isAdmin is available via useAuth() hook

---

## 25. Metro City Bubbles

### REQ-25.1: Metro Consolidation
City bubbles at wide zoom (< 9) consolidate nearby cities into major US metro areas (~85 metros).

**Test Cases:**
- [ ] `TC-25.1.1`: Bubbles consolidate to major US metro areas (not individual suburb cities)
- [ ] `TC-25.1.2`: Austin and Dallas appear as separate bubbles (not merged)
- [ ] `TC-25.1.3`: Suburb cities (e.g., Frisco, Plano) are consolidated into their parent metro (Dallas-Fort Worth)
- [ ] `TC-25.1.4`: Metro bubble shows total location count across all consolidated cities
- [ ] `TC-25.1.5`: Metro bubble shows total vote count across all consolidated cities
- [ ] `TC-25.1.6`: Metros with zero locations do not show a bubble
- [ ] `TC-25.1.7`: Cities not near any known metro appear as standalone bubbles

### REQ-25.2: Metro Click Behavior
Clicking a metro bubble zooms to the density center of its locations at zoom 9.

**Test Cases:**
- [ ] `TC-25.2.1`: Clicking metro bubble flies map to zoom 9
- [ ] `TC-25.2.2`: At least one location dot is visible after zoom
- [ ] `TC-25.2.3`: Zoom target is the location-weighted centroid of consolidated cities

### REQ-25.3: Release-Aware Bubbles
Metro bubbles reflect the released filter — non-admins see only released location counts.

**Test Cases:**
- [ ] `TC-25.3.1`: Non-admin city summaries only count released locations
- [ ] `TC-25.3.2`: Admin city summaries count based on admin's released filter setting
- [ ] `TC-25.3.3`: Metros with zero locations after release filtering do not show

---

## 26. Released/Unreleased Locations

### REQ-26.1: Released Column
The pp_locations table has a `released` boolean column indicating if a location is publicly visible.

**Test Cases:**
- [ ] `TC-26.1.1`: pp_locations table has `released` boolean column (default false)
- [ ] `TC-26.1.2`: Austin area locations are released
- [ ] `TC-26.1.3`: Palo Alto / Silicon Valley area locations are released
- [ ] `TC-26.1.4`: Boca Raton / Palm Beach area locations are released
- [ ] `TC-26.1.5`: Other locations default to unreleased

### REQ-26.2: Non-Admin Released Filter
Non-admin users only see released locations. Unreleased locations are completely invisible.

**Test Cases:**
- [ ] `TC-26.2.1`: Non-admin users never see unreleased locations in the list
- [ ] `TC-26.2.2`: Non-admin users never see unreleased locations on the map
- [ ] `TC-26.2.3`: City bubble counts only include released locations for non-admins
- [ ] `TC-26.2.4`: Unreleased locations are completely invisible to non-admins (not grayed out)

### REQ-26.3: Admin Released Filter
Admin users can toggle between released, unreleased, or all locations.

**Test Cases:**
- [ ] `TC-26.3.1`: Admin users see a released/unreleased/all filter toggle
- [ ] `TC-26.3.2`: Admin can view only released locations
- [ ] `TC-26.3.3`: Admin can view only unreleased locations
- [ ] `TC-26.3.4`: Admin default shows all locations
- [ ] `TC-26.3.5`: Released filter affects both list and map views

---

## 27. Suggest Form Validation & Sanitization

### REQ-27.1: Required Field Validation
Submitting the suggest form with empty required fields shows inline error messages.

**Test Cases:**
- [ ] `TC-27.1.1`: Empty submit shows errors on address, city, state
- [ ] `TC-27.1.2`: Address error says "Street address is required"
- [ ] `TC-27.1.3`: City error says "City is required"
- [ ] `TC-27.1.4`: State error says "State is required"
- [ ] `TC-27.1.5`: Fixing fields and resubmitting clears errors
- [ ] `TC-27.1.6`: Errors render as red text below field

### REQ-27.2: State Field Validation
State field enforces 2 uppercase letters and auto-uppercases input.

**Test Cases:**
- [ ] `TC-27.2.1`: State "TX" accepted
- [ ] `TC-27.2.2`: State "tx" auto-uppercased to "TX"
- [ ] `TC-27.2.3`: State "T" shows error
- [ ] `TC-27.2.4`: State "123" shows error
- [ ] `TC-27.2.5`: State field has maxLength=2

### REQ-27.3: Square Footage Validation
Square footage is optional but must be numeric when provided.

**Test Cases:**
- [ ] `TC-27.3.1`: Sqft "3500" accepted
- [ ] `TC-27.3.2`: Sqft "3,500" accepted
- [ ] `TC-27.3.3`: Sqft "abc" shows error
- [ ] `TC-27.3.4`: Empty sqft accepted (optional)

### REQ-27.4: Notes Length Validation
Notes must be under 2000 characters.

**Test Cases:**
- [ ] `TC-27.4.1`: Notes under 2000 chars accepted
- [ ] `TC-27.4.2`: Notes over 2000 chars shows error

### REQ-27.5: XSS Sanitization
All text inputs are sanitized to strip HTML tags before storage.

**Test Cases:**
- [ ] `TC-27.5.1`: `<script>` tags stripped from input
- [ ] `TC-27.5.2`: `<b>bold</b>` stripped to "bold"
- [ ] `TC-27.5.3`: Normal text unchanged
- [ ] `TC-27.5.4`: suggestLocation() sanitizes before DB insert

### REQ-27.6: Server Error Handling
Network/server errors display a user-visible error banner.

**Test Cases:**
- [ ] `TC-27.6.1`: Network error shows error banner
- [ ] `TC-27.6.2`: Error banner has red styling
- [ ] `TC-27.6.3`: Error clears on next submit attempt
- [ ] `TC-27.6.4`: Submit button re-enables after failure

### REQ-27.7: School Type Tabs on Suggest Page
The `/suggest` page displays three school type tabs (Micro, Growth, Flagship) that replace the static criteria section. Each tab shows type-specific criteria.

**Test Cases:**
- [ ] `TC-27.7.1`: Three school type tab buttons visible (Micro, Growth, Flagship)
- [ ] `TC-27.7.2`: Micro tab is selected by default (has active styling)
- [ ] `TC-27.7.3`: Micro tab has "FOCUS" badge
- [ ] `TC-27.7.4`: Clicking Growth tab switches content to Growth criteria
- [ ] `TC-27.7.5`: Clicking Flagship tab switches content to Flagship criteria
- [ ] `TC-27.7.6`: Each tab shows criteria sections (Physical, Neighborhood, Economics)
- [ ] `TC-27.7.7`: Each tab shows tagline in colored callout
- [ ] `TC-27.7.8`: Each tab shows a timeline
- [ ] `TC-27.7.9`: Submitted notes start with "School type: Micro" when Micro tab active
- [ ] `TC-27.7.10`: Submitted notes start with "School type: Growth" when Growth tab active
- [ ] `TC-27.7.11`: Submitted notes start with "School type: Flagship" when Flagship tab active

### REQ-27.8: Suggest Button Links to /suggest Page
The main page suggest button navigates directly to the `/suggest` full form page (modal removed).

**Test Cases:**
- [ ] `TC-27.8.1`: Main page suggest button links to /suggest (no modal)
- [ ] `TC-27.8.2`: Suggest button has amber styling and plus icon

### REQ-27.9: School Type Badge on Admin Cards
Admin location cards parse the school type from notes and display it as a colored badge.

**Test Cases:**
- [ ] `TC-27.9.1`: parseSchoolType extracts school type from "School type: Micro\nrest"
- [ ] `TC-27.9.2`: parseSchoolType returns null for notes without school type prefix
- [ ] `TC-27.9.3`: parseSchoolType returns null for empty/null notes
- [ ] `TC-27.9.4`: AdminLocationCard source includes parseSchoolType import
- [ ] `TC-27.9.5`: AdminLocationCard renders school type badge with color classes (blue/purple/amber)

---

## 28. Help Requests

### REQ-28.1: Help Request Submission
The HelpModal submits help requests to a backend API that persists them and sends a help guide email.

**Test Cases:**
- [ ] `TC-28.1.1`: HelpModal calls fetch to POST /api/help-request on submit (code review)
- [ ] `TC-28.1.2`: API route inserts row into pp_help_requests table (code review)
- [ ] `TC-28.1.3`: API route calls sendEmail with generateHelpGuideHtml (code review)
- [ ] `TC-28.1.4`: Unauthenticated user provides email in form (code review: email input exists)
- [ ] `TC-28.1.5`: Authenticated user uses session email (code review: user.email fallback)

### REQ-28.2: Admin Help Requests Tab
The admin page has a third tab "Help Requests" that shows all help requests.

**Test Cases:**
- [ ] `TC-28.2.1`: Admin page has three tabs (Suggestions, Likes, Help Requests)
- [ ] `TC-28.2.2`: Help Requests tab shows count badge
- [ ] `TC-28.2.3`: Each card shows email and date (code review: AdminHelpRequestCard)
- [ ] `TC-28.2.4`: Location-specific requests show address (code review)
- [ ] `TC-28.2.5`: Empty state when no requests (code review)

### REQ-28.3: Help Guide Email
The help guide email template includes location-specific and general variants with 4 help action items.

**Test Cases:**
- [ ] `TC-28.3.1`: generateHelpGuideHtml exists with location-specific variant (code review)
- [ ] `TC-28.3.2`: generateHelpGuideHtml exists with general variant (code review)
- [ ] `TC-28.3.3`: Email includes 4 help action items (property owners, zoning, parents, government)

---

## 29. Mobile UX

### REQ-29.1: Mobile Collapsed View
The mobile bottom sheet collapsed view includes auth, help, and suggest controls matching the desktop panel.

**Test Cases:**
- [ ] `TC-29.1.1`: Mobile bottom sheet has AuthButton (code review: page.tsx)
- [ ] `TC-29.1.2`: Mobile collapsed view has HelpModal (code review: page.tsx)
- [ ] `TC-29.1.3`: Mobile collapsed view has Suggest button (code review: page.tsx)
- [ ] `TC-29.1.4`: AuthButton accepts darkBg prop (code review: AuthButton.tsx)
- [ ] `TC-29.1.5`: Mobile expanded panel is max-h-[50vh] (code review: page.tsx)

### REQ-29.2: Mobile Touch & Readability
Mobile-specific improvements for touch targets, text sizing, popup positioning, and map padding.

**Test Cases:**
- [ ] `TC-29.2.1`: VoteButton has min-h-[44px] on mobile (code review: VoteButton.tsx)
- [ ] `TC-29.2.2`: SizeLabel uses text-[11px] on mobile (code review: ScoreBadge.tsx)
- [ ] `TC-29.2.3`: ScoreLegend uses fixed positioning on mobile (code review: ScoreBadge.tsx)
- [ ] `TC-29.2.4`: flyToCoords includes bottom padding on mobile (code review: MapView.tsx)

---

## Section 30: Vote Comments

### REQ-30.1: Vote Comment Dialog
When an authenticated parent clicks the heart button to vote, a dialog appears asking "Want to tell us why you like this spot?" with an optional textarea (500 char max). The parent can either "Just vote" (no comment) or "Vote with comment". Closing the dialog without action still fires the vote.

**Test Cases:**
- [ ] `TC-30.1.1`: VoteButton shows comment dialog on authenticated vote click (code review: VoteButton.tsx showComment state)
- [ ] `TC-30.1.2`: Comment textarea has 500 character max with counter (code review: VoteButton.tsx maxLength={500})
- [ ] `TC-30.1.3`: "Just vote" button votes without comment (code review: VoteButton.tsx handleSkip)
- [ ] `TC-30.1.4`: "Vote with comment" sends comment through onVote (code review: VoteButton.tsx handleVoteWithComment)
- [ ] `TC-30.1.5`: onVote prop accepts optional comment parameter threaded through LocationCard → LocationsList → Zustand (code review: votes.ts vote signature)

### REQ-30.2: Admin Comment Display
The admin Likes tab shows voter comments alongside voter emails. The API returns `voter_comments` with email and comment for each vote. Votes without comments show email only.

**Test Cases:**
- [ ] `TC-30.2.1`: Likes API returns voter_comments array with email and comment (code review: admin/likes/route.ts)
- [ ] `TC-30.2.2`: Admin likes tab shows comments alongside voter emails (code review: AdminLocationCard.tsx voter comments section)
- [ ] `TC-30.2.3`: Votes without comments display email only, no empty quotes (code review: AdminLocationCard.tsx filter for vc.comment)

---

## Test Execution Summary

| # | Category | Total TCs |
|---|----------|-----------|
| 1 | Layout & Structure | 13 |
| 2 | Header & Branding | 8 |
| 3 | Map Functionality | 19 |
| 4 | Locations List | 31 |
| 5 | Voting System | 12 |
| 6 | Suggest Location | 20 |
| 7 | How It Works | 4 |
| 8 | Responsive Design | 11 |
| 9 | Data Layer | 18 |
| 10 | Performance | 7 |
| 11 | Accessibility | 11 |
| 12 | Error Handling | 5 |
| 13 | Environment | 3 |
| 14 | Tech Stack | 9 |
| 15 | Address Autocomplete & Geocoding | 17 |
| 16 | Authentication | 10 |
| 17 | Admin Review Workflow | 23 |
| 18 | Score Display | 21 |
| 19 | Two-Tier Zoom Model | 12 |
| 20 | City Summaries List | 6 |
| 21 | Geolocation | 5 |
| 22 | List Pagination | 6 |
| 23 | TODO-Based Parent Assistance Emails | 19 |
| 24 | Admin vs Non-Admin Filters | 13 |
| 25 | Metro City Bubbles | 13 |
| 26 | Released/Unreleased Locations | 14 |
| 27 | Suggest Form Validation & Sanitization | 43 |
| 28 | Help Requests | 13 |
| 29 | Mobile UX | 9 |
| 30 | Vote Comments | 8 |
| | **TOTAL** | **403** |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02-04 | Initial MVP requirements |
| 1.1.0 | 2026-02-05 | Added auth requirements (Section 16), updated data layer to reflect Supabase integration, aligned v2 scope with location selection brainlift |
| 1.2.0 | 2026-02-05 | Added admin review workflow (Section 17): admin page, approve/reject, score sync, email notifications |
| 1.3.0 | 2026-02-06 | TDD audit: fixed REQ-3.2 (geolocation default view), added Sections 18-22 (scores, two-tier zoom, city summaries, geolocation, pagination), added 2 TCs to Section 9 (row pagination), total 261 TCs |
| 1.4.0 | 2026-02-06 | Added TODO-based parent assistance emails (Section 23): zoning/demographics/pricing TODOs with scenario-specific messaging, 19 TCs |
| 1.5.0 | 2026-02-07 | TDD audit: Updated REQ-4.2 (search→filters), REQ-4.5 (on-screen only), REQ-18 (score display redesign: 4 subscores, card tint, artifact link, size label, popup redesign), updated tagline, 293 total TCs |
| 1.6.0 | 2026-02-09 | Added admin/non-admin filters (Section 24), metro city bubbles (Section 25), released/unreleased locations (Section 26), view-as-parent toggle, 40 TCs, total 333 TCs |
| 1.7.0 | 2026-02-21 | Added suggest form validation & XSS sanitization (Section 27): required field validation, state auto-uppercase, sqft numeric check, notes length, HTML tag stripping, error banners, 25 TCs, total 358 TCs |
| 1.8.0 | 2026-02-21 | Added school type tabs (REQ-27.7/27.8/27.9): Micro/Growth/Flagship tabs on suggest page and modal, school type in notes, admin badge parsing, 21 TCs, total 379 TCs |
| 1.9.0 | 2026-02-21 | Added help requests (Section 28): DB storage, API endpoint, help guide email, admin tab, 13 TCs, total 386 TCs |
| 2.0.0 | 2026-02-21 | Added mobile UX (Section 29): auth/help/suggest in collapsed view, 50vh panel, touch targets, score legend positioning, flyTo padding, 9 TCs, total 395 TCs |
| 2.1.0 | 2026-02-21 | Added vote comments (Section 30): optional comment on vote, DB column + constraint, admin display, 8 TCs, total 403 TCs |

---

## Out of Scope (v2 - Future)

See `docs/brainlift-location-selection.md` for full strategic context.

- **Moody's data ETL:** Filter commercial RE listings by size tier (Micro 2.5-7.5K SF, Growth 15-50K SF, Flagship 50-150K SF) and load into pp_locations + pp_listings
- **Location and Zoning scoring:** Enrollment Score (ES), Wealth Score (WS), and Relative Scores per brainlift thresholds (>2,500 ideal, <1,250 exclude); Microschools require zoned-by-right; larger schools accept CUP/SUP; reject if school use prohibited
- **Score display:** ~~Show consumer-level scoring on location cards~~ DONE — synced from `real_estate_listings` into `pp_location_scores`, displayed on cards and map popups
- **TODO: Score locations.** 1,899 active locations. **1,165 have no scores at all** — `overall_score` is NULL in `real_estate_listings` for these addresses. Scoring agent needs to run on them.

  **Unscored locations by metro:**

  | Metro | Unscored |
  |-------|----------|
  | New York, NY | **700** |
  | Brooklyn, NY | **205** |
  | Boca Raton, FL | 100 |
  | West Palm Beach, FL | 64 |
  | Boynton Beach, FL | 25 |
  | Delray Beach, FL | 21 |
  | Palm Beach Gardens, FL | 13 |
  | North Palm Beach, FL | 9 |
  | Jupiter, FL | 7 |
  | Other (Lantana, Greenacres, Palm Springs, etc.) | 21 |
  | **Total** | **1,165** |

  Of the 734 that are scored, 140 are missing Price sub-scores and 50 are missing Neighborhood. Re-sync after scoring agent fills gaps: `SELECT sync_scores_from_listings();`.
- **Scoring trigger:** Auto-score when parent suggests a location (separate agent)
- **Parent assistance solicitation:** ~~Low-scoring locations prompt parents for help (zoning contacts, local knowledge, capacity commitments)~~ DONE — TODO-enhanced approval emails with zoning/demographics/pricing action items (Section 18)
- **Admin review workflow:** ~~UI to review/approve parent-suggested locations~~ DONE — `/admin` page with approve/reject/pull-scores, email notifications via Resend
- **Dealing with listings:** Right now we are only showing the best score per listing, and our scheme only supports having one. This should be addressed eventually, though scores don't vary much at the same location so we punted for now.
- **New market detection is oversimplified:** Currently uses state-level matching against a hardcoded list of Alpha school locations (e.g., any location in CA/FL/TX/AZ/VA/NC is "existing market"). This is wrong — a location in rural Northern California is not the same market as LA or SF. Needs proper metro-level matching (MSA or similar) to determine if a location is truly in an existing Alpha metro vs. a new market launch. Affects pricing TODO scenarios (P1/P2 vs P3).
