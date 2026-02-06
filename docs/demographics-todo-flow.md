# Demographics TODO Flow

How to generate actionable TODOs for parents when demographics score is RED.

## Problem Statement

What do we actually need to answer for any location?

1. Can the area sustain a 250-student school? (target)
2. Can the area sustain a "minimum efficient school"? (100 students)

---

## Minimum Efficient School Size

**Current value: 100 students** 

This is the break-even enrollment for target profitability.

---

## School Size Tiers

From `alpha-size-classification`:

| Tier | Sq Ft | Students | Use Case |
|------|-------|----------|----------|
| Micro | 2,500 - 7,500 | 25 | Launch / demand-building (1-2 years) |
| Micro2 | 7,500 - 15,000 | 50-75 | Expanded micro format |
| Growth | 15,000 - 50,000 | 250 | Target sustainable school |
| Full Size | 50,000 - 150,000 | 1,000 | Large-scale campus |

---

## RED (Kill) Thresholds

A location is RED for a given school size if ANY of these are true.

> Note: Thresholds are the same across tiers for now, but may become more restrictive for larger schools in future versions.

### Micro (25 students)

| Metric | Threshold | Implication |
|--------|-----------|-------------|
| Absolute wealth | < 1,250 households | Not enough affluent families |
| Absolute enrollment | < 1,250 K-8 students | Not enough established private school demand |
| Relative wealth | < 25th percentile | Area is less affluent than surroundings |
| Relative enrollment | < 25th percentile | Fewer private school students than surroundings |

### Micro2 (50-75 students)

| Metric | Threshold | Implication |
|--------|-----------|-------------|
| Absolute wealth | < 1,250 households | Not enough affluent families |
| Absolute enrollment | < 1,250 K-8 students | Not enough established private school demand |
| Relative wealth | < 25th percentile | Area is less affluent than surroundings |
| Relative enrollment | < 25th percentile | Fewer private school students than surroundings |

### Growth (250 students)

| Metric | Threshold | Implication |
|--------|-----------|-------------|
| Absolute wealth | < 1,250 households | Not enough affluent families |
| Absolute enrollment | < 1,250 K-8 students | Not enough established private school demand |
| Relative wealth | < 25th percentile | Area is less affluent than surroundings |
| Relative enrollment | < 25th percentile | Fewer private school students than surroundings |

### Full Size (1,000 students)

| Metric | Threshold | Implication |
|--------|-----------|-------------|
| Absolute wealth | < 1,250 households | Not enough affluent families |
| Absolute enrollment | < 1,250 K-8 students | Not enough established private school demand |
| Relative wealth | < 25th percentile | Area is less affluent than surroundings |
| Relative enrollment | < 25th percentile | Fewer private school students than surroundings |


---

## Parent Fix Scenarios

When demographics are weak, don't reject — generate TODOs based on which scenario applies.

> **Note:** All scenarios require 25 enrolled students (deposits paid) as the baseline. Pricing may require more — use `max(25, break-even students)`.

**Which scenario set to use?** 

| Property Size | Scenario Set |
|---------------|--------------|
| < 15,000 sq ft (Micro, Micro2) | Micro scenarios (M1, M2, M3) |
| ≥ 15,000 sq ft (Growth, Full Size) | Growth scenarios (G1, G2, ...) |

---

### Micro School Scenarios

For properties < 15,000 sq ft (Micro and Micro2).

#### M1: Good Metro, Weak Submarket

**Condition:** This specific location is weak, but somewhere in the greater metro has:
- 2,500+ absolute wealth AND
- 2,500+ absolute enrollment

**TODO for Parent:**
> "Our demographics show this isn't the strongest part of town, but we trust your recommendation. If you can get **25 enrolled students (deposits paid)** for this location, we'll open it."

---

#### M2: Weak Metro, But Viable

**Condition:** The entire metro is weak, but somewhere has > 1,000 in absolute wealth AND enrollment:

**TODO for Parent:**
> "Our demographics show this metro can't support a 250-person Alpha, but we trust your recommendation. If you can get **25 enrolled students (deposits paid)** for this location, we'll open it."

---

#### M3: Metro Can't Support Minimum Viable

**Condition:** Even the best part of the metro can't support 10x minimum viable school size.

**Framing for Parent:**
> "Our demographics show this metro can't support a 250-student Alpha. It can't even support our minimum efficient size (100 students). We're happy to move forward, but this will require **significant financial commitment** from you."

**TODOs for Parent:**
   > "If you can donate the building, then I can make it work at 50 students. So if you provide a space suitable for 50+ students (5,000+ sq ft), and get us started with 25 enrolled students (deposits) paid). We'll get this going. I'll take the risk to get from 25 to 50. If we get demand beyond 50 we can take the next step on our own.

---

### Definitions

- **Deposit** = paid enrollment commitment (required to count as "registered")


### Open Questions

1. How do we define "metro area" for metro-level checks? (county for now)
