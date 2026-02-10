# Simplifying Scores for Parents

## The Problem

The current app shows parents 5 technical sub-scores — Demographics, Price, Zoning, Neighborhood, Building — each with a numeric value and 4-tier color system. These are real estate evaluation metrics designed for internal site selection. Parents can't interpret "Demographics 73" and have no way to act on "Price: Amber."

Parents are being asked to **vote**, not evaluate properties. The scoring display should help them make better voting decisions and — critically — mobilize them to help solve problems.

## The Approach

Replace 5 analyst scores with **3 parent-meaningful signals**, each tied to a question parents naturally ask and an action they can take. Collapse the 4-tier color system (green/yellow/amber/red) into **3 simple tiers** that match how people actually think: good, okay, or bad.

---

## The 3 Tiers

### Green — "Great"
**What it means:** This dimension is strong. No concerns. This is a positive signal for your vote.

**How parents read it:** "This checks out — one less thing to worry about."

### Yellow — "Workable"
**What it means:** This dimension has potential but isn't perfect. It's not a dealbreaker, and Alpha is aware. Things may need to fall into place, but there's a reasonable path forward.

**How parents read it:** "Not ideal, but not a showstopper. Let's see how it develops."

### Red — "Unacceptable (Without Help)"
**What it means:** There's a significant obstacle in this dimension. Alpha can't solve it alone — but **you might be able to help.** Each red signal comes with a specific call to action.

**How parents read it:** "There's a problem here — but maybe I can do something about it."

---

## The 3 Dimensions

### 1. Area
**What it measures:** Is this a strong area for families like ours?

Combines two internal metrics: the demographic demand analysis (are there enough families who'd pay for premium private school?) and the neighborhood quality assessment (is the surrounding area safe, attractive, and appropriate?).

| Tier | Label | What It Means to Parents |
|------|-------|-------------------------|
| Green | "Strong area" | This is a proven family neighborhood with strong demand for quality education. Families like yours already live and invest here. |
| Yellow | "Developing area" | The area shows promise — there are families nearby, but demand isn't as established as in top-tier neighborhoods. The school could be a catalyst for the community. |
| Red | "Needs support" | Our data doesn't show strong enough demand to justify this location on its own. **But our data may be wrong — and the brainlift says so.** |

**Red Call to Action:**
> "We don't see enough demand here yet — but you know your community better than we do. **If you believe this area can support an Alpha school, rally your neighbors.** Get friends and families to vote for this location. If you can demonstrate community commitment, we'll make it work."

This directly maps to the Parent Override model: if parents can fill 25 students for a microschool, Alpha will open regardless of the demographic score.

---

### 2. Space
**What it measures:** Is this building a good fit for a school?

Combines the building suitability assessment (size, condition, layout) with the financial viability (is the rent sustainable relative to tuition revenue?).

| Tier | Label | What It Means to Parents |
|------|-------|-------------------------|
| Green | "Great space" | The building is the right size, in good condition, and financially viable. This could be a school. |
| Yellow | "Workable space" | The space could work but has tradeoffs — maybe it needs some renovation, or the economics are tight. Alpha is evaluating whether the numbers work. |
| Red | "Challenging" | The building has significant issues — either it's not well-suited for a school, or the economics don't work at this price point. |

**Red Call to Action:**
> "This building has obstacles that make it hard for us. **Do you know of a better space nearby?** Parents often have local knowledge about unlisted properties, landlords open to negotiation, or spaces about to become available. Use the 'Suggest Location' feature to tell us about it."

Parents' local knowledge of available spaces is one of their most valuable contributions — the brainlift explicitly identifies "Parent Search" as one of three site collection channels.

---

### 3. Readiness
**What it measures:** Can a school legally open here in the near term?

This is the zoning assessment: is school use permitted by right, does it require a conditional use permit, or is it prohibited entirely?

| Tier | Label | What It Means to Parents |
|------|-------|-------------------------|
| Green | "Ready to open" | Schools are permitted by right at this location. If everything else lines up, a microschool could open here this year. |
| Yellow | "Permit needed" | School use requires a conditional or special use permit (CUP/SUP). This is achievable but takes time and effort to navigate the approval process. |
| Red | "Zoning hurdle" | School use is currently not permitted at this location. This requires either a zoning change or finding a way to make the current zoning work. |

**Red Call to Action:**
> "Schools aren't currently permitted here, and that's a real obstacle. **But zoning decisions are made by local officials — people you may know.** Do you have connections at city hall? Know a land-use attorney who's gotten school approvals? Have you been through a zoning process before? Your local political knowledge and relationships can be the difference between 'impossible' and 'approved.'"

This is where parents' civic networks are most directly valuable. The brainlift's core philosophy — "excited families have the best local knowledge, networks, and capabilities" — applies most powerfully to regulatory obstacles.

---

## Before and After

**Current card (analyst view):**
```
[72]  Demographics 68  Price 42  Zoning 91  Neighborhood 75  Building 80
```

**New card (parent view):**
```
[●]  Strong area · Workable space · Ready to open
```

---

## Why This Works

1. **Actionable, not informational.** Each red signal tells parents what to DO, not just what's wrong.
2. **Respects parent intelligence.** Parents know their neighborhoods. They don't need a number to tell them Boca Raton is affluent. But they do need to know if zoning is a blocker.
3. **Three tiers match real decisions.** People don't make 4-tier judgments. They think "good / okay / bad." Green/yellow/red is universal.
4. **Mobilizes the right people.** A parent with city council connections sees "Zoning hurdle" and knows they can help. Under the old system, they'd see "Zoning 31" and have no idea what to do.
5. **Preserves depth for the curious.** The overall dot still links to the full Moody's report for parents who want to dig in.
