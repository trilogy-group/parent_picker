# Pricing TODO Flow

How to generate actionable TODOs for parents when pricing score is RED.

## Problem Statement

1. Can we afford this space at the market tuition rate?
2. If not, what would make the economics work?

---

## Pricing Score Recap

**Cost per student** = annual_cost / (space_size / 100)

| Tuition Tier | GREEN | RED |
|--------------|-------|-----|
| $40k | ≤ $6,000/student | ≥ $10,000/student |
| $50k | ≤ $10,000/student | ≥ $15,000/student |
| $65k+ | ≤ $15,000/student | ≥ $20,000/student |

---

## RED Conditions

Pricing is RED when cost per student exceeds the RED threshold for the market's tuition tier.

---

## Parent Fix Scenarios

When pricing is RED, don't reject — generate TODOs.

> **Note:** P1 and P2 can be combined. Negotiate a partial rent reduction AND subsidize the remaining gap.

> **Subsidy end condition:** All subsidies end when we reach the GREEN threshold (cost per student ≤ GREEN).

---

### P1: Negotiate Lower Rent

If you can get us better rent, we'll do it. Here's what we need:

**TODO for Parent:**
> "This location is too expensive at the current asking price.
>
> | Metric | Current | What We Need |
> |--------|---------|--------------|
> | Rent | $[CURRENT_RENT]/SF/year | $[TARGET_RENT]/SF/year |
> | Annual cost | $[ANNUAL_COST] | $[SUPPORTABLE_ANNUAL] |
> | Monthly | $[ACTUAL_MONTHLY] | $[SUPPORTABLE_MONTHLY] |
> | Gap | **$[GAP_MONTHLY]/month** | $0 |
>
> **If you can negotiate the rent down to $[TARGET_RENT]/SF/year, we're in.**
>
> If the landlord won't go that low, let us know what they'll accept — we can calculate the subsidy needed to bridge the gap (see P2)."

**Calculation:**
```
students = space_size / 100
supportable_annual = GREEN_THRESHOLD × students
gap_annual = annual_cost - supportable_annual
gap_monthly = gap_annual / 12
target_rent = supportable_annual / space_size
```

---

### P2: Rent Subsidy

Alternatively, you can subsidize the gap until we hit GREEN.

**TODO for Parent:**
> "If the landlord won't budge on rent, you can subsidize the difference.
>
> | Metric | Current | What We Need |
> |--------|---------|--------------|
> | Rent | $[CURRENT_RENT]/SF/year | (unchanged) |
> | Annual cost | $[ANNUAL_COST] | $[SUPPORTABLE_ANNUAL] |
> | Monthly | $[ACTUAL_MONTHLY] | $[SUPPORTABLE_MONTHLY] |
> | Gap | **$[GAP_MONTHLY]/month** | $0 |
>
> Subsidy continues until enrollment reaches GREEN threshold, then ends."

**Calculation:**
```
students = space_size / 100
supportable_annual = GREEN_THRESHOLD × students
gap_annual = annual_cost - supportable_annual
gap_monthly = gap_annual / 12
```

---

### P3: New Metro Launch Subsidy

**Applies when:** No existing Alpha in metro AND property is RED at 25 students.

In new metros, we start with 25 students regardless of space size. If annual_cost / 25 ≥ RED threshold, we need a launch subsidy.

**TODO for Parent:**
> "This is a new market for Alpha — no existing school in [METRO]. We start new markets with 25 students.
>
> | Metric | Current (25 students) | What We Need |
> |--------|----------------------|--------------|
> | Rent | $[CURRENT_RENT]/SF/year | (unchanged) |
> | Annual cost | $[ANNUAL_COST] | $[SUPPORTABLE_ANNUAL] |
> | Monthly | $[ACTUAL_MONTHLY] | $[SUPPORTABLE_MONTHLY] |
> | Gap | **$[GAP_MONTHLY]/month** | $0 |
>
> Subsidy decreases as enrollment grows. Ends at [BREAK_EVEN] students."

**Calculation:**
```
students = 25  # launch size, not space capacity
supportable_annual = GREEN_THRESHOLD × students
gap_annual = annual_cost - supportable_annual
gap_monthly = gap_annual / 12
break_even_students = annual_cost / GREEN_THRESHOLD
```

**P3 check:**
```
if annual_cost / 25 >= RED_THRESHOLD → P3 applies
```

---

## Scenario Selection

| Condition | Scenario |
|-----------|----------|
| Existing Alpha in metro, pricing RED | P1 and/or P2 |
| New metro, GREEN at 25 students | No pricing TODO needed |
| New metro, RED at 25 students | P3 |

---

## Definitions

- **Tuition tier** = market tuition ($40k, $50k, $65k+) from `alpha-tuition-tier`
- **GREEN threshold** = max cost/student where pricing is viable
- **Students capacity** = space_size / 100 SF
- **Subsidy** = monthly payment covering gap between supportable and actual rent
- **Break-even** = enrollment where cost/student reaches GREEN threshold

---

## TODOs

- [ ] Build method to check "existing Alpha in metro" (database query? API?)

---

## Examples

### Example 1: P1 Rent Negotiation

**Scenario:** $40k tier, 5,000 SF, $120/SF asking

```
students_capacity = 5,000 / 100 = 50 students
current_annual = $120 × 5,000 = $600,000
current_cost_per_student = $600,000 / 50 = $12,000 → RED

target_annual = $6,000 × 50 = $300,000
target_rent = $300,000 / 5,000 = $60/SF/year
reduction = ($120 - $60) / $120 = 50%
```

**Result:** Need rent reduced from $120/SF to $60/SF (50% reduction).

---

### Example 2: P2 Rent Subsidy

**Scenario:** $40k tier, 5,000 SF, $120/SF rent (landlord won't budge)

```
students_capacity = 50
supportable_annual = $6,000 × 50 = $300,000 → $25,000/month
actual_annual = $600,000 → $50,000/month
gap = $50,000 - $25,000 = $25,000/month
```

**Result:** Subsidy of $25,000/month until enrollment grows enough to hit GREEN.

---

### Example 3: P3 New Metro Launch

**Scenario:** $40k tier, 15,000 SF Micro2, $80/SF rent, new metro

```
capacity = 15,000 / 100 = 150 students
annual_cost = $80 × 15,000 = $1,200,000

At full capacity (150 students):
  cost_per_student = $1,200,000 / 150 = $8,000 → YELLOW (would be fine)

At launch (25 students):
  cost_per_student = $1,200,000 / 25 = $48,000 → RED (P3 applies)

supportable_at_25 = $6,000 × 25 = $150,000/year → $12,500/month
actual = $1,200,000/year → $100,000/month
gap = $100,000 - $12,500 = $87,500/month

break_even = $1,200,000 / $6,000 = 200 students
```

**Result:** Launch subsidy of $87,500/month, decreasing as enrollment grows, ending at 200 students.

---

### Example 4: RED Progression

**Scenario:** $40k tier, 5,000 SF (50 students capacity), varying rents

| Rent/SF | Annual Cost | Cost/Student | Rating |
|---------|-------------|--------------|--------|
| $30 | $150,000 | $3,000 | GREEN |
| $50 | $250,000 | $5,000 | GREEN |
| $80 | $400,000 | $8,000 | YELLOW |
| $120 | $600,000 | $12,000 | RED |
