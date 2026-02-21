export interface CriteriaItem {
  label: string;
  value: string;
}

export interface CriteriaSection {
  heading: string;
  icon: "building" | "tree" | "dollar";
  items: CriteriaItem[];
}

export interface SchoolType {
  key: string;
  label: string;
  shortLabel: string;
  students: string;
  focus: boolean;
  tagline: string;
  criteria: CriteriaSection[];
  timeline: string;
}

export const SCHOOL_TYPES: SchoolType[] = [
  {
    key: "micro",
    label: "Micro",
    shortLabel: "Micro",
    students: "25 students",
    focus: true,
    tagline: "Small, nimble locations that can open fast — our fastest path to your neighborhood.",
    criteria: [
      {
        heading: "Physical Criteria",
        icon: "building",
        items: [
          { label: "Interior space", value: "2,500-20,000 sq ft" },
          { label: "Athletic space", value: "On-site playscape / yard or walkable park (<5 min)" },
          { label: "Site type", value: "Stand-alone commercial, or partnerships with complementary operators (e.g., athletic centers)" },
          { label: "Occupancy", value: "Exclusive use preferred; shared space OK if students are fully separate" },
          { label: "Access", value: "Safe, obvious car drop-off/pick-up at the entrance" },
          { label: "Bathrooms", value: "Exclusive-use preferred; shared OK with safety review" },
        ],
      },
      {
        heading: "Neighborhood",
        icon: "tree",
        items: [
          { label: "Surroundings", value: "Mainly upper-end residential/retail; avoid industrial or warehouse districts" },
          { label: "Zoning", value: "School-friendly zoning in place" },
        ],
      },
      {
        heading: "Economics & Lease Targets",
        icon: "dollar",
        items: [
          { label: "Budget", value: "Varies by city, typically not an issue" },
          { label: "Lease term", value: "Max 2-year base term, with annual renewals thereafter" },
        ],
      },
    ],
    timeline: "Can open in as little as 3 months with the right space",
  },
  {
    key: "growth",
    label: "Growth",
    shortLabel: "Growth",
    students: "250 students",
    focus: false,
    tagline: "Mid-size campuses for established neighborhoods with proven demand.",
    criteria: [
      {
        heading: "Physical Criteria",
        icon: "building",
        items: [
          { label: "Interior space", value: "20,000-50,000 sq ft" },
          { label: "Athletic space", value: "On-site playscape and small field" },
          { label: "Site type", value: "Stand-alone strongly preferred" },
          { label: "Access", value: "Parking for 15+ cars with drop-off loop" },
        ],
      },
      {
        heading: "Neighborhood",
        icon: "tree",
        items: [
          { label: "Surroundings", value: "Mainly upper-end residential/retail; avoid industrial or warehouse districts" },
          { label: "Zoning", value: "School-friendly zoning in place for fast opening; otherwise we can work to secure approvals for next school year" },
        ],
      },
      {
        heading: "Economics & Lease Targets",
        icon: "dollar",
        items: [
          { label: "Budget", value: "Varies by city, typically not an issue" },
          { label: "Lease term", value: "Target 5-year base term with 5-year option; purchases considered" },
        ],
      },
    ],
    timeline: "Typically 12-18 months",
  },
  {
    key: "flagship",
    label: "Flagship",
    shortLabel: "Flagship",
    students: "1,000 students",
    focus: false,
    tagline: "Full-scale campuses with comprehensive facilities for high-demand markets.",
    criteria: [
      {
        heading: "Physical Criteria",
        icon: "building",
        items: [
          { label: "Interior space", value: "50,000-150,000 sq ft" },
          { label: "Athletic space", value: "Space for on-site athletic facilities (full size field, gym, etc.)" },
          { label: "Site type", value: "Stand-alone campus" },
          { label: "Access", value: "Full parking lot with bus/van staging area" },
        ],
      },
      {
        heading: "Neighborhood",
        icon: "tree",
        items: [
          { label: "Surroundings", value: "Mainly upper-end residential/retail; avoid industrial or warehouse districts" },
          { label: "Zoning", value: "Realistic path to school-permitted zoning" },
        ],
      },
      {
        heading: "Economics & Lease Targets",
        icon: "dollar",
        items: [
          { label: "Budget", value: "Varies by city, typically not an issue" },
          { label: "Lease term", value: "Long-term lease or purchase" },
        ],
      },
    ],
    timeline: "Typically 3-4 years",
  },
];

export function parseSchoolType(notes: string | null | undefined): {
  schoolType: string | null;
  remainingNotes: string | null;
} {
  if (!notes) return { schoolType: null, remainingNotes: null };

  const match = notes.match(/^School type: (.+?)(?:\n|$)/);
  if (!match) return { schoolType: null, remainingNotes: notes };

  const schoolType = match[1];
  const remaining = notes.slice(match[0].length).trim();
  return {
    schoolType,
    remainingNotes: remaining || null,
  };
}
