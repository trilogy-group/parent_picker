/**
 * Extract the street portion from an address, stripping city/state/zip if present.
 * Always strips zip+4 suffixes (-XXXX).
 */
export function extractStreet(address: string, city: string): string {
  if (!address) return "";

  let street = address;

  // Remove zip+4 pattern (e.g., "78746-1234")
  street = street.replace(/\s*\d{5}(-\d{4})?\s*$/, "");

  // Remove state abbreviation at end (e.g., ", TX" or " TX")
  street = street.replace(/[,\s]+[A-Z]{2}\s*$/, "");

  // Remove city at end (case-insensitive)
  if (city) {
    const cityPattern = new RegExp(`[,\\s]+${escapeRegex(city)}\\s*$`, "i");
    street = street.replace(cityPattern, "");
  }

  return street.trim();
}

/**
 * Format a city/state/zip line like "Austin, TX 78746".
 * Strips +4 from zip if present.
 */
export function formatCityLine(city: string, state: string, zip?: string): string {
  let line = `${city}, ${state}`;
  if (zip) {
    // Strip +4 suffix
    line += ` ${zip.replace(/-\d{4}$/, "")}`;
  }
  return line;
}

/**
 * True when name differs meaningfully from the street address
 * and isn't a "Suggested: ..." label.
 */
export function hasDistinctName(name: string, streetAddress: string): boolean {
  if (!name || !streetAddress) return false;
  if (name.toLowerCase().startsWith("suggested:")) return false;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  return normalize(name) !== normalize(streetAddress);
}

/**
 * Extract 5-digit zip code from an address string.
 * Matches zip (with optional +4) typically near the end.
 */
export function extractZip(address: string): string | undefined {
  const match = address.match(/\b(\d{5})(-\d{4})?\s*$/);
  return match ? match[1] : undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
