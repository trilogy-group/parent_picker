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
- [ ] `TC-1.3.5`: Expanded state shows full locations list with search

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
- [ ] `TC-2.2.1`: Tagline "Help us find the best locations for new micro schools" is visible
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

### REQ-4.2: Search/Filter
A search input allows filtering locations.

**Test Cases:**
- [ ] `TC-4.2.1`: Search input has placeholder "Search locations..."
- [ ] `TC-4.2.2`: Search input has magnifying glass icon
- [ ] `TC-4.2.3`: Typing filters list in real-time
- [ ] `TC-4.2.4`: Filter matches location name, address, or city
- [ ] `TC-4.2.5`: Empty results show "No locations found" message
- [ ] `TC-4.2.6`: Clearing search restores full list

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

### REQ-4.5: Viewport-Aware Sorting
The locations list sorts based on map viewport visibility.

**Business Logic:**
- Locations visible on the map viewport are sorted by votes (descending)
- Locations outside the viewport are sorted by distance from map center (ascending)
- Visible locations always appear first in the list, followed by non-visible locations
- As users pan/zoom the map, the list reorders dynamically

**Test Cases:**
- [ ] `TC-4.5.1`: Locations visible in viewport appear at top of list
- [ ] `TC-4.5.2`: Visible locations are sorted by vote count (highest first)
- [ ] `TC-4.5.3`: Non-visible locations appear below visible ones
- [ ] `TC-4.5.4`: Non-visible locations are sorted by distance to reference point (closest first)
- [ ] `TC-4.5.5`: List reorders when user pans map to show different locations
- [ ] `TC-4.5.6`: List reorders when user zooms map to change viewport bounds
- [ ] `TC-4.5.7`: List is sorted by distance from map center on initial load (before geolocation resolves)

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
A prominent button allows suggesting new locations.

**Test Cases:**
- [ ] `TC-6.1.1`: Button text is "Suggest a Location"
- [ ] `TC-6.1.2`: Button has plus icon
- [ ] `TC-6.1.3`: Button is amber/yellow colored (bg-amber-400)
- [ ] `TC-6.1.4`: Button is visible in panel (desktop) and bottom sheet (mobile)

### REQ-6.2: Suggest Modal
Clicking the button opens a modal dialog.

**Test Cases:**
- [ ] `TC-6.2.1`: Modal opens on button click
- [ ] `TC-6.2.2`: Modal has title "Suggest a New Location"
- [ ] `TC-6.2.3`: Modal has description text
- [ ] `TC-6.2.4`: Modal can be closed with X button
- [ ] `TC-6.2.5`: Modal can be closed with Escape key
- [ ] `TC-6.2.6`: Modal has backdrop overlay

### REQ-6.3: Suggest Form
The modal contains a form for location details.

**Test Cases:**
- [ ] `TC-6.3.1`: Form has Street Address field (required)
- [ ] `TC-6.3.2`: Form has City field (required)
- [ ] `TC-6.3.3`: Form has State field (required, 2 char max)
- [ ] `TC-6.3.4`: Form has Notes field (optional)
- [ ] `TC-6.3.5`: Form has Cancel button
- [ ] `TC-6.3.6`: Form has Submit button
- [ ] `TC-6.3.7`: Submit is disabled while submitting

### REQ-6.4: Suggest Submission
Submitting the form adds a new suggested location.

**Test Cases:**
- [ ] `TC-6.4.1`: Valid submission closes modal
- [ ] `TC-6.4.2`: New location appears in list with "Parent Suggested" badge
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

### REQ-18.1: Score Badge on Location Cards
Scored locations display an overall score badge and sub-score pills on their cards.

**Test Cases:**
- [ ] `TC-18.1.1`: Scored locations show a circular overall score badge
- [ ] `TC-18.1.2`: Overall badge is color-coded (green/yellow/amber/red)
- [ ] `TC-18.1.3`: Unscored locations do not show any score badge
- [ ] `TC-18.1.4`: Sub-score pills display for Demographics, Price, Zoning, Neighborhood, Building
- [ ] `TC-18.1.5`: Sub-score pills are color-coded by border color matching their score tier
- [ ] `TC-18.1.6`: Missing sub-scores show "–" instead of a number
- [ ] `TC-18.1.7`: Sub-score pills with report URLs are clickable links that open in new tab

### REQ-18.2: Score-Colored Map Markers
Individual location dots on the map are colored by their overall score.

**Test Cases:**
- [ ] `TC-18.2.1`: Dots with GREEN score are green (#22c55e)
- [ ] `TC-18.2.2`: Dots with YELLOW score are yellow (#facc15)
- [ ] `TC-18.2.3`: Dots with AMBER score are amber (#f59e0b)
- [ ] `TC-18.2.4`: Dots with RED score are red (#ef4444)
- [ ] `TC-18.2.5`: Dots with no score are dark gray (#475569)

### REQ-18.3: Score in Popup
Selected location popup displays score badge.

**Test Cases:**
- [ ] `TC-18.3.1`: Popup for scored location shows ScoreBadge component

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
- [ ] `TC-22.1.5`: Pagination resets when search query changes
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

---

## Test Execution Summary

| # | Category | Total TCs |
|---|----------|-----------|
| 1 | Layout & Structure | 13 |
| 2 | Header & Branding | 8 |
| 3 | Map Functionality | 19 |
| 4 | Locations List | 26 |
| 5 | Voting System | 12 |
| 6 | Suggest Location | 23 |
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
| 18 | Score Display | 13 |
| 19 | Two-Tier Zoom Model | 12 |
| 20 | City Summaries List | 6 |
| 21 | Geolocation | 5 |
| 22 | List Pagination | 6 |
| 23 | TODO-Based Parent Assistance Emails | 19 |
| | **TOTAL** | **280** |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02-04 | Initial MVP requirements |
| 1.1.0 | 2026-02-05 | Added auth requirements (Section 16), updated data layer to reflect Supabase integration, aligned v2 scope with location selection brainlift |
| 1.2.0 | 2026-02-05 | Added admin review workflow (Section 17): admin page, approve/reject, score sync, email notifications |
| 1.3.0 | 2026-02-06 | TDD audit: fixed REQ-3.2 (geolocation default view), added Sections 18-22 (scores, two-tier zoom, city summaries, geolocation, pagination), added 2 TCs to Section 9 (row pagination), total 261 TCs |
| 1.4.0 | 2026-02-06 | Added TODO-based parent assistance emails (Section 23): zoning/demographics/pricing TODOs with scenario-specific messaging, 19 TCs, total 280 TCs |

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
