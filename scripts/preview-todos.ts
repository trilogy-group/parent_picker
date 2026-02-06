/**
 * Temp script to preview TODO email generation for each scenario path.
 * Run with: npx tsx scripts/preview-todos.ts
 */

// Inline the types and logic to avoid path alias issues
interface SubScore { score: number | null; color: string | null; detailsUrl: string | null; }
interface LocationScores {
  overall: number | null; overallColor: string | null; overallDetailsUrl: string | null;
  demographics: SubScore; price: SubScore; zoning: SubScore; neighborhood: SubScore; building: SubScore;
}
interface UpstreamMetrics {
  enrollmentScore: number | null; wealthScore: number | null;
  relativeEnrollmentScore: number | null; relativeWealthScore: number | null;
  rentPerSfYear: number | null; rentPeriod: string | null;
  spaceSizeAvailable: number | null; sizeClassification: string | null;
  zoningCode: string | null; lotZoning: string | null;
  county: string | null; city: string | null; state: string | null;
}
interface MetroInfo {
  market: string | null; tuition: number | null; hasExistingAlpha: boolean;
  greenThreshold: number; redThreshold: number;
}
type TodoType = "zoning" | "demographics" | "pricing";
interface LocationTodo {
  type: TodoType; scenario: string; title: string; message: string;
  dataTable?: { label: string; current: string; needed: string; gap?: string }[];
}

// ---- todo-generator logic (copied) ----
function fmt(n: number): string { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fmtDollars(n: number): string { return "$" + fmt(n); }
function fmtRent(n: number): string { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 }); }

function generateZoningTodo(scores: LocationScores, metrics: UpstreamMetrics): LocationTodo | null {
  if (scores.zoning.color !== "RED") return null;
  const zoneCode = metrics.zoningCode || metrics.lotZoning;
  const zoneStr = zoneCode ? ` (${zoneCode})` : "";
  return {
    type: "zoning", scenario: "Z1", title: "Zoning: Schools Prohibited",
    message: `Private schools are prohibited in this zone${zoneStr}. To proceed, you'll need to get a Conditional Use Permit (CUP) or get the property rezoned. This typically takes months, so it likely won't work for this school year. If you have contacts in local government who can expedite the process, that would help.`,
  };
}

function generateDemographicsTodo(scores: LocationScores, metrics: UpstreamMetrics): LocationTodo | null {
  if (scores.demographics.color !== "RED") return null;
  const es = metrics.enrollmentScore; const ws = metrics.wealthScore;
  const res = metrics.relativeEnrollmentScore; const rws = metrics.relativeWealthScore;
  if (es == null || ws == null || res == null || rws == null) {
    return { type: "demographics", scenario: "M-generic", title: "Demographics: Area Needs More Families",
      message: "Our demographics analysis shows this area may not have enough affluent families to support a school. If you can get 25 enrolled students (deposits paid) for this location, we'll open it." };
  }
  const metroMaxEnrollment = res > 0 ? es / res : 0;
  const metroMaxWealth = rws > 0 ? ws / rws : 0;
  if (metroMaxEnrollment >= 2500 && metroMaxWealth >= 2500) {
    return { type: "demographics", scenario: "M1", title: "Demographics: Weak Submarket, Strong Metro",
      message: "Our demographics show this isn't the strongest part of town, but we trust your recommendation. If you can get 25 enrolled students (deposits paid) for this location, we'll open it.",
      dataTable: [
        { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
        { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "2,500+" },
        { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
        { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "2,500+" },
      ] };
  }
  if (metroMaxEnrollment >= 1000 || metroMaxWealth >= 1000) {
    return { type: "demographics", scenario: "M2", title: "Demographics: Weak Metro",
      message: "Our demographics show this metro can't support a 250-person Alpha long term, but we trust your recommendation. If you can get 25 enrolled students (deposits paid) for this location, we'll open it.",
      dataTable: [
        { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
        { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "2,500+" },
        { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
        { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "2,500+" },
      ] };
  }
  return { type: "demographics", scenario: "M3", title: "Demographics: Very Weak Metro",
    message: "Our demographics show this metro can't support a 250-student Alpha. It can't even support our minimum efficient size (100 students). We're happy to move forward, but this will require significant financial commitment from you. If you can provide a space suitable for 50+ students (5,000+ SF) and get us started with 25 enrolled students (deposits paid), we'll get this going. We'll take the risk to get from 25 to 50. If we get demand beyond 50, we can take the next step on our own.",
    dataTable: [
      { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
      { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "1,000+" },
      { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
      { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "1,000+" },
    ] };
}

function generatePricingTodo(scores: LocationScores, metrics: UpstreamMetrics, metro: MetroInfo): LocationTodo | null {
  if (scores.price.color !== "RED") return null;
  const rent = metrics.rentPerSfYear; const space = metrics.spaceSizeAvailable;
  if (rent == null || space == null || space <= 0) {
    return { type: "pricing", scenario: "P-generic", title: "Pricing: Too Expensive",
      message: "This location is too expensive at the current asking price. If you can negotiate a lower rent with the landlord, or subsidize the difference, we can make it work. Contact us with the best rent you can negotiate." };
  }
  const annualCost = rent * space; const greenThreshold = metro.greenThreshold;
  if (metro.hasExistingAlpha) {
    const students = space / 100;
    const supportableAnnual = greenThreshold * students;
    const gapAnnual = annualCost - supportableAnnual;
    const gapMonthly = gapAnnual / 12;
    const targetRent = supportableAnnual / space;
    return { type: "pricing", scenario: "P1/P2", title: "Pricing: Rent Too High",
      message: "This location is too expensive at the current asking price. Option 1: Negotiate the rent down. Option 2: Subsidize the gap until enrollment grows. These can be combined — negotiate a partial rent reduction AND subsidize the remaining gap.",
      dataTable: [
        { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: `${fmtRent(targetRent)}/SF/year`, gap: `${fmtRent(rent - targetRent)}/SF/year` },
        { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAnnual), gap: fmtDollars(gapAnnual) },
        { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAnnual / 12), gap: fmtDollars(gapMonthly) },
        { label: "Student capacity", current: `${fmt(students)} students`, needed: "" },
      ] };
  }
  const costPer25 = annualCost / 25;
  if (costPer25 >= metro.redThreshold) {
    const capacity = Math.floor(space / 100);
    const breakEven = Math.ceil(annualCost / greenThreshold);
    const costAtCapacity = annualCost / capacity;
    if (costAtCapacity <= greenThreshold) {
      const supportableAt25 = greenThreshold * 25;
      const gapAnnual = annualCost - supportableAt25;
      const gapMonthly = gapAnnual / 12;
      return { type: "pricing", scenario: "P3a", title: "Pricing: New Market Launch Subsidy",
        message: `This is a new market for Alpha. We start new markets with 25 students. At this rent, you'll need to subsidize the gap until enrollment grows. Subsidy decreases as enrollment grows and ends at ${fmt(breakEven)} students (building capacity: ${fmt(capacity)}).`,
        dataTable: [
          { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: "(unchanged)", gap: "" },
          { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAt25), gap: fmtDollars(gapAnnual) },
          { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAt25 / 12), gap: fmtDollars(gapMonthly) },
          { label: "Break-even enrollment", current: "25 students", needed: `${fmt(breakEven)} students` },
          { label: "Building capacity", current: `${fmt(capacity)} students`, needed: "" },
        ] };
    }
    const supportableAtCapacity = greenThreshold * capacity;
    const gapAtCapacityAnnual = annualCost - supportableAtCapacity;
    const gapAtCapacityMonthly = gapAtCapacityAnnual / 12;
    const targetRent = greenThreshold * capacity / space;
    const supportableAt25 = greenThreshold * 25;
    const launchGapMonthly = (supportableAtCapacity - supportableAt25) / 12;
    return { type: "pricing", scenario: "P3b", title: "Pricing: Too Expensive Even at Capacity",
      message: `This is a new market for Alpha. Even at full capacity (${fmt(capacity)} students), the rent is too high. You'll need to negotiate the rent down or subsidize the gap permanently. We also start new markets with 25 students, so even at the lower rent you'll need a launch subsidy of ${fmtDollars(Math.round(launchGapMonthly))}/month that decreases as enrollment grows to ${fmt(capacity)}.`,
      dataTable: [
        { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: `${fmtRent(targetRent)}/SF/year`, gap: `${fmtRent(rent - targetRent)}/SF/year` },
        { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAtCapacity), gap: fmtDollars(gapAtCapacityAnnual) },
        { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAtCapacity / 12), gap: fmtDollars(gapAtCapacityMonthly) },
        { label: "Building capacity", current: `${fmt(capacity)} students`, needed: "" },
        { label: "Launch subsidy (at target rent)", current: `${fmtDollars(Math.round(launchGapMonthly))}/month`, needed: `Ends at ${fmt(capacity)} students` },
      ] };
  }
  return null;
}

function generateTodos(scores: LocationScores, metrics: UpstreamMetrics, metro: MetroInfo): LocationTodo[] {
  const todos: LocationTodo[] = [];
  const z = generateZoningTodo(scores, metrics); if (z) todos.push(z);
  const d = generateDemographicsTodo(scores, metrics); if (d) todos.push(d);
  const p = generatePricingTodo(scores, metrics, metro); if (p) todos.push(p);
  return todos;
}

// ---- email-todos logic (copied) ----
const TODO_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  zoning: { bg: "#fef2f2", border: "#fca5a5", header: "#dc2626" },
  demographics: { bg: "#fefce8", border: "#fde047", header: "#ca8a04" },
  pricing: { bg: "#fff7ed", border: "#fdba74", header: "#ea580c" },
};

function scoreRow(label: string, score: number | null, isOverall = false): string {
  if (score === null) return "";
  const pct = isOverall ? score : Math.round(score * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : pct >= 25 ? "#f59e0b" : "#ef4444";
  return `<tr><td style="padding:4px 8px;font-size:14px;">${label}</td><td style="padding:4px 8px;font-size:14px;font-weight:bold;color:${color};">${pct}</td></tr>`;
}

function todoSection(todo: LocationTodo): string {
  const colors = TODO_COLORS[todo.type] || TODO_COLORS.zoning;
  let dataTableHtml = "";
  if (todo.dataTable && todo.dataTable.length > 0) {
    const hasGapColumn = todo.dataTable.some(row => row.gap !== undefined);
    const rows = todo.dataTable.map(row =>
      `<tr><td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;">${row.label}</td><td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${row.current}</td><td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">${row.needed}</td>${hasGapColumn ? `<td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${row.gap || ""}</td>` : ""}</tr>`
    ).join("");
    dataTableHtml = `<table style="border-collapse:collapse;width:100%;margin-top:10px;background:#fff;border-radius:4px;"><tr style="background:#f3f4f6;"><th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Metric</th><th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Current</th><th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">What We Need</th>${hasGapColumn ? `<th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Gap</th>` : ""}</tr>${rows}</table>`;
  }
  return `<div style="margin-top:16px;border:1px solid ${colors.border};border-radius:8px;overflow:hidden;"><div style="background:${colors.bg};padding:10px 14px;border-bottom:1px solid ${colors.border};"><h3 style="margin:0;font-size:15px;color:${colors.header};">${todo.title}</h3></div><div style="padding:12px 14px;"><p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:#374151;">${todo.message}</p>${dataTableHtml}</div></div>`;
}

interface EmailScoreInfo { overall: number | null; demographics: number | null; price: number | null; zoning: number | null; neighborhood: number | null; building: number | null; }

function generateTodoApprovalHtml(loc: {name:string;address:string;city:string;state:string}, scores: EmailScoreInfo | undefined, todos: LocationTodo[]): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `<h3 style="margin-top:20px;">Location Scores</h3><table style="border-collapse:collapse;">${scoreRow("Overall", scores.overall, true)}${scoreRow("Demographics", scores.demographics)}${scoreRow("Price", scores.price)}${scoreRow("Zoning", scores.zoning)}${scoreRow("Neighborhood", scores.neighborhood)}${scoreRow("Building", scores.building)}</table>`;
  }
  const todoSections = todos.map(todoSection).join("");
  const todoIntro = todos.length > 0 ? `<p style="margin-top:16px;font-size:14px;color:#374151;">There are a few things that need your help to make this location work. See the action items below:</p>` : "";
  const cta = todos.length > 0
    ? `<p style="margin-top:16px;">Share the link with other parents to rally support and help with these action items!</p>`
    : `<p>Share the link with other parents to rally votes for this location!</p>`;
  return `<h2>Great news!</h2><p>Your suggested location <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} has been approved and is now live on the Parent Picker map.</p>${scoreSection}${todoIntro}${todoSections}${cta}<p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>`;
}

// ---- SCENARIOS ----
function makeScores(overrides: Partial<{overall:number;demographics:number;price:number;zoning:number;neighborhood:number;building:number;demoColor:string;priceColor:string;zoningColor:string}>): LocationScores {
  const s = (v: number, c?: string): SubScore => ({ score: v, color: c || (v >= 0.75 ? "GREEN" : v >= 0.5 ? "YELLOW" : v >= 0.25 ? "AMBER" : "RED"), detailsUrl: null });
  return {
    overall: overrides.overall ?? 30,
    overallColor: (overrides.overall ?? 30) >= 75 ? "GREEN" : (overrides.overall ?? 30) >= 50 ? "YELLOW" : (overrides.overall ?? 30) >= 25 ? "AMBER" : "RED",
    overallDetailsUrl: null,
    demographics: s(overrides.demographics ?? 0.5, overrides.demoColor),
    price: s(overrides.price ?? 0.5, overrides.priceColor),
    zoning: s(overrides.zoning ?? 0.5, overrides.zoningColor),
    neighborhood: s(overrides.neighborhood ?? 0.5),
    building: s(overrides.building ?? 0.5),
  };
}

import * as fs from "fs";
import * as path from "path";

const outputDir = path.join(process.cwd(), "scripts", "email-previews");
fs.mkdirSync(outputDir, { recursive: true });

function writePreview(name: string, html: string) {
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>body{font-family:-apple-system,sans-serif;max-width:650px;margin:40px auto;padding:20px;}</style></head><body>${html}</body></html>`;
  const fp = path.join(outputDir, `${name}.html`);
  fs.writeFileSync(fp, wrapped);
  console.log(`  → ${fp}`);
}

// === 1. ZONING Z1 (with zone code) ===
console.log("\n=== 1. ZONING Z1: 444 S Cedros Ave, Solana Beach, CA ===");
{
  const loc = { name: "444 S Cedros Ave", address: "444 S Cedros Ave", city: "Solana Beach", state: "CA" };
  const scores = makeScores({ overall: 30, zoning: 0, zoningColor: "RED", demographics: 0.5, price: 0.7 });
  const metrics: UpstreamMetrics = { enrollmentScore: 2315, wealthScore: 10266, relativeEnrollmentScore: 0.486, relativeWealthScore: 0.504, rentPerSfYear: 54, rentPeriod: null, spaceSizeAvailable: 6000, sizeClassification: "Micro", zoningCode: null, lotZoning: "SC", county: null, city: "Solana Beach", state: "CA" };
  const metro: MetroInfo = { market: "CA - Los Angeles", tuition: 50000, hasExistingAlpha: true, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 30, demographics: 0.5, price: 0.7, zoning: 0, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("1-zoning-Z1", html);
}

// === 2. DEMOGRAPHICS M1: Strong metro, weak submarket ===
console.log("\n=== 2. DEMOGRAPHICS M1: 100 Woods Ct, Franklin, TN ===");
{
  const loc = { name: "100 Woods Ct", address: "100 Woods Ct", city: "Franklin", state: "TN" };
  // es=315, ws=1081, res=0.0495, rws=0.192 → metro_max_es=6370, metro_max_ws=5627 → both >= 2500 → M1
  const scores = makeScores({ overall: 20, demographics: 0, demoColor: "RED", zoning: 0.7, price: 0.5 });
  const metrics: UpstreamMetrics = { enrollmentScore: 315, wealthScore: 1081, relativeEnrollmentScore: 0.0495, relativeWealthScore: 0.192, rentPerSfYear: 52.94, rentPeriod: null, spaceSizeAvailable: 6800, sizeClassification: "Micro", zoningCode: "PD", lotZoning: null, county: null, city: "Franklin", state: "TN" };
  const metro: MetroInfo = { market: null, tuition: 50000, hasExistingAlpha: false, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 20, demographics: 0, price: 0.5, zoning: 0.7, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("2-demographics-M1", html);
}

// === 3. DEMOGRAPHICS M2: Weak metro ===
console.log("\n=== 3. DEMOGRAPHICS M2: 10308 Cardera Dr, Riverview, FL ===");
{
  const loc = { name: "10308 Cardera Dr", address: "10308 Cardera Dr", city: "Riverview", state: "FL" };
  // es=214, ws=1504, res=0.0959, rws=0.353 → metro_max_es=2232, metro_max_ws=4261 → ES<2500 → not M1, but both >= 1000 → M2
  const scores = makeScores({ overall: 15, demographics: 0.05, demoColor: "RED", zoning: 0.5, zoningColor: "YELLOW", price: 0.5 });
  const metrics: UpstreamMetrics = { enrollmentScore: 214, wealthScore: 1504, relativeEnrollmentScore: 0.0959, relativeWealthScore: 0.353, rentPerSfYear: 40, rentPeriod: null, spaceSizeAvailable: 12389, sizeClassification: "Micro2", zoningCode: "PD", lotZoning: null, county: null, city: "Riverview", state: "FL" };
  const metro: MetroInfo = { market: "FL - Miami", tuition: 50000, hasExistingAlpha: true, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 15, demographics: 0.05, price: 0.5, zoning: 0.5, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("3-demographics-M2", html);
}

// === 4. DEMOGRAPHICS M3: Very weak metro (synthetic - no real examples exist) ===
console.log("\n=== 4. DEMOGRAPHICS M3: Synthetic small-town location ===");
{
  const loc = { name: "123 Main St", address: "123 Main St", city: "Rural Town", state: "WY" };
  // Both metro maxes < 1000 → M3
  const scores = makeScores({ overall: 10, demographics: 0, demoColor: "RED", zoning: 0.5, price: 0.3 });
  const metrics: UpstreamMetrics = { enrollmentScore: 50, wealthScore: 80, relativeEnrollmentScore: 0.1, relativeWealthScore: 0.15, rentPerSfYear: 15, rentPeriod: "ANNUAL", spaceSizeAvailable: 4000, sizeClassification: "Micro", zoningCode: null, lotZoning: "R-1", county: null, city: "Rural Town", state: "WY" };
  const metro: MetroInfo = { market: null, tuition: 50000, hasExistingAlpha: false, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 10, demographics: 0, price: 0.3, zoning: 0.5, neighborhood: 0.3, building: 0.3 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("4-demographics-M3", html);
}

// === 5. PRICING P1/P2: Existing Alpha in metro ===
console.log("\n=== 5. PRICING P1/P2: 3100 Grand Ave, Miami, FL ===");
{
  const loc = { name: "3100 Grand Ave", address: "3100 Grand Ave", city: "Miami", state: "FL" };
  // FL has Alpha. rent=177/SF, space=100000 (Full Size)
  // students=1000, annual=$17.7M, supportable=$10k*1000=$10M, gap=$7.7M/yr
  const scores = makeScores({ overall: 25, price: 0, priceColor: "RED", demographics: 0.8, demoColor: "GREEN", zoning: 0.5, zoningColor: "YELLOW" });
  const metrics: UpstreamMetrics = { enrollmentScore: null, wealthScore: null, relativeEnrollmentScore: null, relativeWealthScore: null, rentPerSfYear: 177, rentPeriod: null, spaceSizeAvailable: 100000, sizeClassification: "Full Size", zoningCode: null, lotZoning: null, county: null, city: "Miami", state: "FL" };
  const metro: MetroInfo = { market: "FL - Miami", tuition: 50000, hasExistingAlpha: true, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 25, demographics: 0.8, price: 0, zoning: 0.5, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("5-pricing-P1P2", html);
}

// === 6a. PRICING P3a: Works at capacity, not at 25 (Mountain View numbers, new-metro) ===
console.log("\n=== 6a. PRICING P3a: 435 N Whisman Rd, Mountain View, CA (as new metro) ===");
{
  const loc = { name: "435 N Whisman Rd", address: "435 N Whisman Rd", city: "Mountain View", state: "CA" };
  // Real data: rent=$394,944 total → normalized $51/SF. space=7,744 SF.
  // capacity=77. cost_at_capacity=$51*100=$5,100 (GREEN). cost_at_25=$51*7744/25=$15,798 (RED).
  // break_even = ceil($394,944/$10,000) = 40 students. Capacity 77 > 40 → P3a.
  const scores = makeScores({ overall: 20, price: 0, priceColor: "RED", demographics: 0.8, demoColor: "GREEN", zoning: 0, zoningColor: "RED" });
  const metrics: UpstreamMetrics = { enrollmentScore: 9957, wealthScore: 41520, relativeEnrollmentScore: 0.805, relativeWealthScore: 0.854, rentPerSfYear: 51, rentPeriod: null, spaceSizeAvailable: 7744, sizeClassification: "Micro", zoningCode: "P(41)", lotZoning: "P(41)", county: null, city: "Mountain View", state: "CA" };
  const metro: MetroInfo = { market: null, tuition: 50000, hasExistingAlpha: false, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 20, demographics: 0.8, price: 0, zoning: 0, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("6a-pricing-P3a", html);
}

// === 6b. PRICING P3b: Doesn't work even at capacity ===
console.log("\n=== 6b. PRICING P3b: 7468 Noah Reid Rd, Chattanooga, TN ===");
{
  const loc = { name: "7468 Noah Reid Rd", address: "7468 Noah Reid Rd", city: "Chattanooga", state: "TN" };
  // rent=$390.86/SF, space=11,769 SF.
  // capacity=117. cost_at_capacity=$390.86*100=$39,086 (way above $10k GREEN). → P3b.
  const scores = makeScores({ overall: 15, price: 0, priceColor: "RED", demographics: 0, demoColor: "RED", zoning: 0.7, zoningColor: "GREEN" });
  const metrics: UpstreamMetrics = { enrollmentScore: null, wealthScore: null, relativeEnrollmentScore: null, relativeWealthScore: null, rentPerSfYear: 390.86, rentPeriod: null, spaceSizeAvailable: 11769, sizeClassification: "Micro2", zoningCode: null, lotZoning: null, county: null, city: "Chattanooga", state: "TN" };
  const metro: MetroInfo = { market: null, tuition: 50000, hasExistingAlpha: false, greenThreshold: 10000, redThreshold: 15000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 15, demographics: 0, price: 0, zoning: 0.7, neighborhood: 0.3, building: 0.3 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("6b-pricing-P3b", html);
}

// === 7. MULTI-RED: Zoning + Demographics + Pricing all RED ===
console.log("\n=== 7. MULTI-RED: 6800 Burleson Rd, Austin, TX (zoning+demographics RED) ===");
{
  const loc = { name: "6800 Burleson Rd", address: "6800 Burleson Rd", city: "Austin", state: "TX" };
  // es=80, ws=1416, res=0.024, rws=0.104 → metro_max_es=3346, metro_max_ws=13615 → both >= 2500 → M1
  // zoning RED, zoning_code=LI-PDA-NP
  const scores = makeScores({ overall: 10, demographics: 0, demoColor: "RED", zoning: 0, zoningColor: "RED", price: 0.6 });
  const metrics: UpstreamMetrics = { enrollmentScore: 80, wealthScore: 1416, relativeEnrollmentScore: 0.024, relativeWealthScore: 0.104, rentPerSfYear: 24.5, rentPeriod: null, spaceSizeAvailable: 16474, sizeClassification: "Micro2", zoningCode: "LI-PDA-NP", lotZoning: "LI-PDA-NP", county: null, city: "Austin", state: "TX" };
  const metro: MetroInfo = { market: "TX - Austin", tuition: 40000, hasExistingAlpha: true, greenThreshold: 6000, redThreshold: 10000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 10, demographics: 0, price: 0.6, zoning: 0, neighborhood: 0.5, building: 0.5 };
  const html = generateTodoApprovalHtml(loc, emailScores, todos);
  writePreview("7-multi-zoning-demographics", html);
}

// === 8. NO RED: Clean approval (no TODOs) ===
console.log("\n=== 8. NO RED SCORES: Standard approval email ===");
{
  const loc = { name: "1201 Spyglass Dr", address: "1201 Spyglass Dr", city: "Austin", state: "TX" };
  const scores = makeScores({ overall: 80, demographics: 0.87, demoColor: "GREEN", zoning: 1.0, zoningColor: "GREEN", price: 0.8, priceColor: "GREEN", neighborhood: 0.75, building: 0.8 });
  const metrics: UpstreamMetrics = { enrollmentScore: 2929, wealthScore: 11423, relativeEnrollmentScore: 0.878, relativeWealthScore: 0.584, rentPerSfYear: 30, rentPeriod: "ANNUAL", spaceSizeAvailable: 5000, sizeClassification: "Micro", zoningCode: null, lotZoning: null, county: null, city: "Austin", state: "TX" };
  const metro: MetroInfo = { market: "TX - Austin", tuition: 40000, hasExistingAlpha: true, greenThreshold: 6000, redThreshold: 10000 };
  const todos = generateTodos(scores, metrics, metro);
  console.log(`  TODOs: ${todos.length === 0 ? "(none — standard approval)" : todos.map(t => t.scenario).join(", ")}`);
  const emailScores: EmailScoreInfo = { overall: 80, demographics: 0.87, price: 0.8, zoning: 1.0, neighborhood: 0.75, building: 0.8 };
  // For no-todo case, use plain approval
  const html = `<h2>Great news!</h2><p>Your suggested location <strong>${loc.name}</strong> at ${loc.address}, ${loc.city}, ${loc.state} has been approved and is now live on the Parent Picker map.</p><h3 style="margin-top:20px;">Location Scores</h3><table style="border-collapse:collapse;">${scoreRow("Overall", emailScores.overall, true)}${scoreRow("Demographics", emailScores.demographics)}${scoreRow("Price", emailScores.price)}${scoreRow("Zoning", emailScores.zoning)}${scoreRow("Neighborhood", emailScores.neighborhood)}${scoreRow("Building", emailScores.building)}</table><p>Share the link with other parents to rally votes for this location!</p><p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>`;
  writePreview("8-no-red-standard", html);
}

console.log("\nDone! Open the HTML files in a browser to preview.");
