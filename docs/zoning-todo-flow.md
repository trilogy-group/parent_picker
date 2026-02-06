# Zoning TODO Flow

How to generate actionable TODOs for parents when zoning score is RED.

## Problem Statement

1. Are private K-12 schools allowed at this location?
2. If not, what would it take to get approval?

---

## Zoning Score Recap

| K-12 Status | Score | Description |
|-------------|-------|-------------|
| Permitted | 1.0 | Schools allowed by-right |
| Conditional | 0.5 | Requires special use permit |
| Prohibited | 0.0 | Schools not allowed in this zone |

---

## RED Condition

Zoning is RED when K-12 status is **Prohibited** (score = 0.0).

---

## Parent Fix

**TODO for Parent:**
> "Private schools are prohibited in this zone ([ZONE_CODE] - [ZONE_DISTRICT]).
>
> To proceed, you'll need to get a Conditional Use Permit (CUP) or get the property rezoned. This typically takes months, so it likely won't work for this school year. If you have contacts in local government who can expedite the process, that would help."

---

## Definitions

- **Permitted** = No special approval needed
- **Conditional** = Allowed with special permit (3-6 months)
- **Prohibited** = Not allowed without CUP or rezoning
- **CUP/SUP** = Conditional/Special Use Permit
- **Rezoning** = Changing the zoning district designation

---

## Examples

### Example: Prohibited in Commercial Zone

**Scenario:** Property in "C-2 General Commercial" zone, schools prohibited

```
Zone: C-2 General Commercial
K-12 Status: Prohibited
Score: 0.0

TODO: Get CUP or rezoning. Likely won't work for this school year.
```
