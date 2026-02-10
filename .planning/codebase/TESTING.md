# Testing Patterns

**Analysis Date:** 2026-02-09

## Test Framework

**Runner:**
- Playwright (sync API) via Python
- Config: `/tests/requirements.test.py`
- Version: Latest (synced to browser via `p.chromium.launch()`)

**Assertion Library:**
- Playwright's built-in assertions: `expect()`, `.to_equal()`, custom assertions via `.get_attribute()`, `.bounding_box()`, etc.
- Python unittest-style assertions: `assert condition, "error message"`

**Run Commands:**
```bash
npm run test                          # Run all tests (calls python tests/requirements.test.py)
python tests/requirements.test.py     # Run directly
BASE_URL=http://localhost:3001 python tests/requirements.test.py  # Custom server
```

**Test Startup:**
- Requires dev server running on `http://localhost:3000` (or override via `BASE_URL` env var)
- Browser contexts: desktop (1440x900) and mobile (375x812 with touch support)
- Initial waits: `wait_for_load_state("networkidle")` + 2-3 second map render wait

## Test File Organization

**Location:**
- Single test file: `/tests/requirements.test.py`
- Not co-located with source code
- Tests are E2E/integration focused (testing full requirements, not unit tests)

**Naming:**
- Test IDs follow format: `TC-{section}.{subsection}.{number}` (e.g., `TC-1.1.1`, `TC-4.2.7`)
- Descriptive names that match requirement text (e.g., "Map canvas fills viewport", "Panel visible at ≥1024px")

**Structure:**
```
/tests/
└── requirements.test.py     # 184 test cases organized by requirement section
```

## Test Structure

**Suite Organization:**
```python
def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Desktop context (1440x900)
        desktop = browser.new_context(viewport={"width": 1440, "height": 900})
        desktop_page = desktop.new_page()

        # Mobile context (375x812 with touch)
        mobile = browser.new_context(viewport={"width": 375, "height": 812}, has_touch=True)
        mobile_page = mobile.new_page()

        # Load pages with waits
        desktop_page.goto(BASE_URL)
        desktop_page.wait_for_load_state("networkidle")
        desktop_page.wait_for_timeout(3000)

        # Run test sections
        print("\n## 1. Layout & Structure")
        @test("TC-1.1.1", "Map canvas fills viewport")
        def _():
            # test logic
        _()

        @test("TC-1.1.2", "Map is interactive (has controls)")
        def _():
            # test logic
        _()
```

**Patterns:**
- Setup: Load page once at start, create page instances for desktop + mobile
- Teardown: Implicit (browser closes when context exits)
- Assertion: `assert condition, "error message"` on each verification
- Helpers: `dismiss_dialogs()` to close auth/suggest dialogs (common pattern for breaking tests)

## Test Decoration

**Test Decorator:**
```python
@test(test_id: str, description: str)
def decorator(func):
    """Tracks passed/failed/skipped results and prints summary"""
    try:
        func(*args, **kwargs)
        results["passed"] += 1
        print(f"  ✓ {test_id}: {description}")
    except AssertionError as e:
        results["failed"] += 1
        failures.append((test_id, description, str(e)))
        print(f"  ✗ {test_id}: {description}")
```

**Skip Decorator:**
```python
@skip(reason: str)
def decorator(func):
    """Skips test and logs reason"""
    results["skipped"] += 1
    print(f"  ⊘ SKIPPED — {reason}")
```

## Selectors & Locators

**Strategy:**
- Prefer `data-testid` attributes for reliable targeting
- Fallback to Playwright selectors: `:has-text()`, `.class-name`, `[role='dialog']`
- Scope mobile tests to specific containers to avoid hidden desktop elements

**Examples:**
```python
# data-testid preferred
panel = desktop_page.locator("[data-testid='desktop-panel']")
card = mobile_page.locator("[data-testid='location-card']")

# Text selectors
canvas = desktop_page.locator(".mapboxgl-canvas")
title = desktop_page.locator("text=Alpha School Locations")

# Complex selectors
button = page.locator("button:has-text('Suggest')")
field = page.locator("input[type='email']")

# Scoped to container (mobile-specific)
suggest = mobile_page.locator("[data-testid='mobile-bottom-sheet'] button:has-text('Suggest')")
```

**Critical Pattern:**
When testing presence of multiple possible selectors, use `.first`:
```python
button = page.locator("[data-testid='vote-button']").first
if button.count() > 0:
    # button exists
```

## Test Coverage

**Current State:**
- 184 test cases documented in `requirements.md`
- 45+ tests implemented and active
- 69+ tests skipped due to:
  - Auth-gated features (voting requires sign-in)
  - Admin-only functionality (score filters, approve/reject)
  - Supabase configuration (dependent on `.env` setup)
  - Features removed (search bar)

**Coverage by Section:**
- Layout & Structure: Implemented (map, panels, mobile sheet)
- Header & Branding: Implemented (title, tagline, vote count)
- Map Functionality: Implemented (zoom, city bubbles, markers, popups)
- Locations List: Partial (filters skipped, list basic checks implemented)
- Voting: Skipped (requires auth + Supabase)
- Suggesting Locations: Skipped (requires auth)
- Admin Routes: Skipped (requires admin auth header)

**Skip Reasons Documented:**
```python
@skip("Score filter panel is admin-only (v1.6.0) — non-admin sees SimpleRedToggle")
@skip("Voting requires auth — skipped")
@skip("Supabase not configured in test environment")
```

## Async Testing

**Pattern:**
```python
@test("TC-2.3.2", "Vote count updates when voting")
def _():
    # Wait for element to be present
    city_card = desktop_page.locator("[data-testid='city-card']").first
    if city_card.count() > 0:
        city_card.click()
        desktop_page.wait_for_timeout(2000)  # Explicit wait for map zoom

    # Check for async result
    votes_el = desktop_page.locator("[data-testid='vote-count']").first
    initial_count = int(votes_el.inner_text())

    # Trigger async action
    vote_btn.click(force=True)
    desktop_page.wait_for_timeout(500)  # Wait for vote to process

    # Verify result
    updated_count = int(votes_el.inner_text())
    assert updated_count == initial_count + 1
```

**Wait Strategies:**
- `wait_for_load_state("networkidle")` for page loads
- `wait_for_timeout(ms)` for animations/re-renders
- `.count()` to check if element exists without waiting
- `.is_visible()` to check visibility
- No implicit waits; all explicit

## Dialog Handling

**Pattern (Critical):**
Radix UI Dialog overlays intercept pointer events. Must dismiss before other interactions:

```python
def dismiss_dialogs():
    """Press Escape to close any open dialog, with fallback reload."""
    dialog = desktop_page.locator("[role='dialog']")
    if dialog.count() > 0 and dialog.first.is_visible():
        desktop_page.keyboard.press("Escape")
        desktop_page.wait_for_timeout(500)
    # Check overlay specifically
    overlay = desktop_page.locator("[data-slot='dialog-overlay'][data-state='open']")
    if overlay.count() > 0:
        desktop_page.keyboard.press("Escape")
        desktop_page.wait_for_timeout(500)
```

**When to Use:**
- After voting (sign-in dialog may appear if not authenticated)
- Before subsequent interactions that may fail if overlay is open
- Called explicitly: `dismiss_dialogs()` at test decision points

## Fixture Patterns

**Test Data:**
- Mock locations embedded in `src/lib/locations.ts` for offline testing
- 50 real locations from TX, FL, CA with deterministic seeded scores
- Seeded random: `seededRandom(seed: number): () => number` for reproducible mock scores

```typescript
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function mockScores(index: number): LocationScores {
  const rand = seededRandom(index * 7919 + 42);
  // deterministic mock scores for each location
}
```

**Fixture Location:**
- `src/lib/locations.ts`: `mockLocations` array with 50 predefined locations
- No separate fixture files; data co-located with usage

## Testing Environment Configuration

**Required:**
- `BASE_URL` environment variable (defaults to `http://localhost:3000`)
- Dev server running: `npm run dev`
- Browser launched headless via Playwright

**Optional:**
- Override: `BASE_URL=http://localhost:3001 python tests/requirements.test.py`

**Offline Mode:**
- Tests work with mock data when Supabase is not configured
- Voting/auth features skipped (require `isSupabaseConfigured = true`)

## Common Test Patterns

**Element Existence:**
```python
# Safe check - doesn't fail if missing
elem = page.locator("[data-testid='icon']")
if elem.count() > 0:
    assert elem.is_visible()
else:
    assert True, "Element not found (optional)"
```

**Text Content:**
```python
title = page.locator("text=Alpha School Locations")
assert title.count() > 0, "Title not visible"

votes = page.locator("text=/\\d+ Votes from Parents/")
assert votes.count() > 0, "Vote count pattern not matched"
```

**Attribute Inspection:**
```python
panel = page.locator("[data-testid='desktop-panel']")
classes = panel.get_attribute("class") or ""
assert "bg-blue-600" in classes, f"Panel missing bg-blue-600: {classes}"
```

**Bounding Box (Layout):**
```python
canvas = page.locator(".mapboxgl-canvas")
box = canvas.bounding_box()
assert box is not None, "Canvas not found"
assert box["width"] >= 1400, f"Canvas width {box['width']} < 1400"
assert box["height"] >= 800, f"Canvas height {box['height']} < 800"
```

**Interaction Flow:**
```python
# 1. Click
button = page.locator("[data-testid='vote-button']").first
button.click(force=True)  # force=True ignores visibility

# 2. Wait for result
page.wait_for_timeout(500)

# 3. Dismiss dialog if present
dismiss_dialogs()

# 4. Verify
expected = page.locator("text=Vote recorded")
assert expected.count() > 0, "Vote not recorded"
```

## Results Tracking

**Output:**
```
============================================================
PARENT PICKER - REQUIREMENTS TEST SUITE
BASE_URL: http://localhost:3000
============================================================

## 1. Layout & Structure
  ✓ TC-1.1.1: Map canvas fills viewport
  ✓ TC-1.1.2: Map is interactive (has controls)
  ⊘ SKIPPED — Voting requires auth

## 2. Header & Branding
  ✓ TC-2.1.1: Title 'Alpha School Locations' visible
  ✗ TC-2.1.2: Title has location pin icon
    Error: Location pin icon not found near title

============================================================
RESULTS: 208 passed, 0 failed, 69 skipped (277 total)
============================================================
```

**Summary:**
- Passes/fails printed with icons (✓, ✗, ⊘)
- Failure details logged immediately
- Final summary at end of run

---

*Testing analysis: 2026-02-09*
