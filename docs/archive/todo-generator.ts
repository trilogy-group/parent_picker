import { LocationScores, UpstreamMetrics, MetroInfo, LocationTodo } from "@/types";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDollars(n: number): string {
  return "$" + fmt(n);
}

function fmtRent(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function generateZoningTodo(
  scores: LocationScores,
  metrics: UpstreamMetrics
): LocationTodo | null {
  if (scores.zoning.color !== "RED") return null;

  const zoneCode = metrics.zoningCode || metrics.lotZoning;
  const zoneStr = zoneCode ? ` (${zoneCode})` : "";

  return {
    type: "zoning",
    scenario: "Z1",
    title: "Zoning: Schools Prohibited",
    message:
      `Private schools are prohibited in this zone${zoneStr}. ` +
      `To proceed, you'll need to get a Conditional Use Permit (CUP) or get the property rezoned. ` +
      `This typically takes months, so it likely won't work for this school year. ` +
      `If you have contacts in local government who can expedite the process, that would help.`,
  };
}

export function generateDemographicsTodo(
  scores: LocationScores,
  metrics: UpstreamMetrics
): LocationTodo | null {
  if (scores.demographics.color !== "RED") return null;

  const es = metrics.enrollmentScore;
  const ws = metrics.wealthScore;
  const res = metrics.relativeEnrollmentScore;
  const rws = metrics.relativeWealthScore;

  // If we don't have the raw scores, give a generic message
  if (es == null || ws == null || res == null || rws == null) {
    return {
      type: "demographics",
      scenario: "M-generic",
      title: "Demographics: Area Needs More Families",
      message:
        "Our demographics analysis shows this area may not have enough affluent families " +
        "to support a school. If you can get 25 enrolled students (deposits paid) for this " +
        "location, we'll open it.",
    };
  }

  // Derive metro max: metro_max = absolute / relative
  const metroMaxEnrollment = res > 0 ? es / res : 0;
  const metroMaxWealth = rws > 0 ? ws / rws : 0;

  // M1: Good metro (max >= 2500 for both), weak submarket
  if (metroMaxEnrollment >= 2500 && metroMaxWealth >= 2500) {
    return {
      type: "demographics",
      scenario: "M1",
      title: "Demographics: Weak Submarket, Strong Metro",
      message:
        "Our demographics show this isn't the strongest part of town, but we trust your recommendation. " +
        "If you can get 25 enrolled students (deposits paid) for this location, we'll open it.",
      dataTable: [
        { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
        { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "2,500+" },
        { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
        { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "2,500+" },
      ],
    };
  }

  // M2: Weak metro but viable (max >= 1000 for both)
  if (metroMaxEnrollment >= 1000 || metroMaxWealth >= 1000) {
    return {
      type: "demographics",
      scenario: "M2",
      title: "Demographics: Weak Metro",
      message:
        "Our demographics show this metro can't support a 250-person Alpha long term, " +
        "but we trust your recommendation. If you can get 25 enrolled students " +
        "(deposits paid) for this location, we'll open it.",
      dataTable: [
        { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
        { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "2,500+" },
        { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
        { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "2,500+" },
      ],
    };
  }

  // M3: Metro can't support minimum viable
  return {
    type: "demographics",
    scenario: "M3",
    title: "Demographics: Very Weak Metro",
    message:
      "Our demographics show this metro can't support a 250-student Alpha. " +
      "It can't even support our minimum efficient size (100 students). " +
      "We're happy to move forward, but this will require significant financial commitment from you. " +
      "If you can provide a space suitable for 50+ students (5,000+ SF) and get us started " +
      "with 25 enrolled students (deposits paid), we'll get this going. " +
      "We'll take the risk to get from 25 to 50. If we get demand beyond 50, " +
      "we can take the next step on our own.",
    dataTable: [
      { label: "This location's enrollment score", current: fmt(Math.round(es)), needed: "2,500+" },
      { label: "Metro max enrollment score", current: fmt(Math.round(metroMaxEnrollment)), needed: "1,000+" },
      { label: "This location's wealth score", current: fmt(Math.round(ws)), needed: "2,500+" },
      { label: "Metro max wealth score", current: fmt(Math.round(metroMaxWealth)), needed: "1,000+" },
    ],
  };
}

export function generatePricingTodo(
  scores: LocationScores,
  metrics: UpstreamMetrics,
  metro: MetroInfo
): LocationTodo | null {
  if (scores.price.color !== "RED") return null;

  const rent = metrics.rentPerSfYear;
  const space = metrics.spaceSizeAvailable;

  // If we don't have rent/space data, give a generic message
  if (rent == null || space == null || space <= 0) {
    return {
      type: "pricing",
      scenario: "P-generic",
      title: "Pricing: Too Expensive",
      message:
        "This location is too expensive at the current asking price. " +
        "If you can negotiate a lower rent with the landlord, or subsidize " +
        "the difference, we can make it work. Contact us with the best rent " +
        "you can negotiate.",
    };
  }

  const annualCost = rent * space;
  const greenThreshold = metro.greenThreshold;

  if (metro.hasExistingAlpha) {
    // P1/P2: Existing Alpha in metro — rent negotiation + subsidy
    const students = space / 100;
    const supportableAnnual = greenThreshold * students;
    const gapAnnual = annualCost - supportableAnnual;
    const gapMonthly = gapAnnual / 12;
    const targetRent = supportableAnnual / space;

    return {
      type: "pricing",
      scenario: "P1/P2",
      title: "Pricing: Rent Too High",
      message:
        "This location is too expensive at the current asking price. " +
        "Option 1: Negotiate the rent down. Option 2: Subsidize the gap until enrollment grows. " +
        "These can be combined — negotiate a partial rent reduction AND subsidize the remaining gap.",
      dataTable: [
        { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: `${fmtRent(targetRent)}/SF/year`, gap: `${fmtRent(rent - targetRent)}/SF/year` },
        { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAnnual), gap: fmtDollars(gapAnnual) },
        { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAnnual / 12), gap: fmtDollars(gapMonthly) },
        { label: "Student capacity", current: `${fmt(students)} students`, needed: "" },
      ],
    };
  }

  // P3: New metro launch — check if RED at 25 students
  const costPer25 = annualCost / 25;
  if (costPer25 >= metro.redThreshold) {
    const capacity = Math.floor(space / 100);
    const breakEven = Math.ceil(annualCost / greenThreshold);
    const costAtCapacity = annualCost / capacity;

    if (costAtCapacity <= greenThreshold) {
      // P3a: Works at capacity, just need launch subsidy
      const supportableAt25 = greenThreshold * 25;
      const gapAnnual = annualCost - supportableAt25;
      const gapMonthly = gapAnnual / 12;

      return {
        type: "pricing",
        scenario: "P3a",
        title: "Pricing: New Market Launch Subsidy",
        message:
          `This is a new market for Alpha. We start new markets with 25 students. ` +
          `At this rent, you'll need to subsidize the gap until enrollment grows. ` +
          `Subsidy decreases as enrollment grows and ends at ${fmt(breakEven)} students ` +
          `(building capacity: ${fmt(capacity)}).`,
        dataTable: [
          { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: "(unchanged)", gap: "" },
          { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAt25), gap: fmtDollars(gapAnnual) },
          { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAt25 / 12), gap: fmtDollars(gapMonthly) },
          { label: "Break-even enrollment", current: "25 students", needed: `${fmt(breakEven)} students` },
          { label: "Building capacity", current: `${fmt(capacity)} students`, needed: "" },
        ],
      };
    }

    // P3b: Doesn't work even at full capacity — need rent reduction + launch subsidy
    const supportableAtCapacity = greenThreshold * capacity;
    const gapAtCapacityAnnual = annualCost - supportableAtCapacity;
    const gapAtCapacityMonthly = gapAtCapacityAnnual / 12;
    const targetRent = greenThreshold * capacity / space; // = greenThreshold / 100

    // Launch subsidy: even at target rent, 25 students can't cover full cost
    const supportableAt25 = greenThreshold * 25;
    const launchGapMonthly = (supportableAtCapacity - supportableAt25) / 12;

    return {
      type: "pricing",
      scenario: "P3b",
      title: "Pricing: Too Expensive Even at Capacity",
      message:
        `This is a new market for Alpha. Even at full capacity (${fmt(capacity)} students), ` +
        `the rent is too high. You'll need to negotiate the rent down ` +
        `or subsidize the gap permanently. We also start new markets with 25 students, ` +
        `so even at the lower rent you'll need a launch subsidy of ` +
        `${fmtDollars(Math.round(launchGapMonthly))}/month that decreases as enrollment grows to ${fmt(capacity)}.`,
      dataTable: [
        { label: "Rent", current: `${fmtRent(rent)}/SF/year`, needed: `${fmtRent(targetRent)}/SF/year`, gap: `${fmtRent(rent - targetRent)}/SF/year` },
        { label: "Annual cost", current: fmtDollars(annualCost), needed: fmtDollars(supportableAtCapacity), gap: fmtDollars(gapAtCapacityAnnual) },
        { label: "Monthly cost", current: fmtDollars(annualCost / 12), needed: fmtDollars(supportableAtCapacity / 12), gap: fmtDollars(gapAtCapacityMonthly) },
        { label: "Building capacity", current: `${fmt(capacity)} students`, needed: "" },
        { label: "Launch subsidy (at target rent)", current: `${fmtDollars(Math.round(launchGapMonthly))}/month`, needed: `Ends at ${fmt(capacity)} students` },
      ],
    };
  }

  // New metro but not RED at 25 students — no pricing TODO needed
  return null;
}

export function generateTodos(
  scores: LocationScores,
  metrics: UpstreamMetrics,
  metro: MetroInfo
): LocationTodo[] {
  const todos: LocationTodo[] = [];

  const zoning = generateZoningTodo(scores, metrics);
  if (zoning) todos.push(zoning);

  const demographics = generateDemographicsTodo(scores, metrics);
  if (demographics) todos.push(demographics);

  const pricing = generatePricingTodo(scores, metrics, metro);
  if (pricing) todos.push(pricing);

  return todos;
}
