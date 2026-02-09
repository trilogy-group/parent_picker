import { CitySummary } from "@/types";
import { getDistanceMiles } from "./locations";

export interface Metro {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

// ~85 major US metro areas for city bubble consolidation
export const US_METROS: Metro[] = [
  // Texas
  { name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698 },
  { name: "Dallas-Fort Worth", state: "TX", lat: 32.7767, lng: -96.7970 },
  { name: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936 },
  { name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
  { name: "El Paso", state: "TX", lat: 31.7619, lng: -106.4850 },
  { name: "Corpus Christi", state: "TX", lat: 27.8006, lng: -97.3964 },

  // Florida
  { name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918 },
  { name: "Fort Lauderdale", state: "FL", lat: 26.1224, lng: -80.1373 },
  { name: "Palm Beach", state: "FL", lat: 26.65, lng: -80.08 },
  { name: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572 },
  { name: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792 },
  { name: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557 },
  { name: "Sarasota", state: "FL", lat: 27.3364, lng: -82.5307 },
  { name: "Fort Myers", state: "FL", lat: 26.6406, lng: -81.8723 },

  // California
  { name: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437 },
  { name: "San Diego", state: "CA", lat: 32.7157, lng: -117.1611 },
  { name: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194 },
  { name: "San Jose", state: "CA", lat: 37.3382, lng: -121.8863 },
  { name: "Sacramento", state: "CA", lat: 38.5816, lng: -121.4944 },
  { name: "Fresno", state: "CA", lat: 36.7378, lng: -119.7871 },
  { name: "Riverside", state: "CA", lat: 33.9533, lng: -117.3962 },
  { name: "Orange County", state: "CA", lat: 33.7175, lng: -117.8311 },
  { name: "Bakersfield", state: "CA", lat: 35.3733, lng: -119.0187 },

  // Northeast
  { name: "New York", state: "NY", lat: 40.7128, lng: -74.0060 },
  { name: "Boston", state: "MA", lat: 42.3601, lng: -71.0589 },
  { name: "Philadelphia", state: "PA", lat: 39.9526, lng: -75.1652 },
  { name: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959 },
  { name: "Hartford", state: "CT", lat: 41.7658, lng: -72.6734 },
  { name: "Providence", state: "RI", lat: 41.8240, lng: -71.4128 },
  { name: "Rochester", state: "NY", lat: 43.1566, lng: -77.6088 },
  { name: "Buffalo", state: "NY", lat: 42.8864, lng: -78.8784 },
  { name: "Albany", state: "NY", lat: 42.6526, lng: -73.7562 },
  { name: "Syracuse", state: "NY", lat: 43.0481, lng: -76.1474 },

  // Mid-Atlantic
  { name: "Washington", state: "DC", lat: 38.9072, lng: -77.0369 },
  { name: "Baltimore", state: "MD", lat: 39.2904, lng: -76.6122 },
  { name: "Richmond", state: "VA", lat: 37.5407, lng: -77.4360 },
  { name: "Virginia Beach", state: "VA", lat: 36.8529, lng: -75.9780 },

  // Southeast
  { name: "Atlanta", state: "GA", lat: 33.7490, lng: -84.3880 },
  { name: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431 },
  { name: "Raleigh-Durham", state: "NC", lat: 35.8801, lng: -78.7880 },
  { name: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816 },
  { name: "Memphis", state: "TN", lat: 35.1495, lng: -90.0490 },
  { name: "Birmingham", state: "AL", lat: 33.5207, lng: -86.8025 },
  { name: "Charleston", state: "SC", lat: 32.7765, lng: -79.9311 },
  { name: "Greensboro", state: "NC", lat: 36.0726, lng: -79.7920 },
  { name: "Knoxville", state: "TN", lat: 35.9606, lng: -83.9207 },
  { name: "Savannah", state: "GA", lat: 32.0809, lng: -81.0912 },
  { name: "Columbia", state: "SC", lat: 34.0007, lng: -81.0348 },
  { name: "Greenville", state: "SC", lat: 34.8526, lng: -82.3940 },

  // Midwest
  { name: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
  { name: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458 },
  { name: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.2650 },
  { name: "Cleveland", state: "OH", lat: 41.4993, lng: -81.6944 },
  { name: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988 },
  { name: "Cincinnati", state: "OH", lat: 39.1031, lng: -84.5120 },
  { name: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581 },
  { name: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065 },
  { name: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  { name: "St. Louis", state: "MO", lat: 38.6270, lng: -90.1994 },
  { name: "Madison", state: "WI", lat: 43.0731, lng: -89.4012 },
  { name: "Omaha", state: "NE", lat: 41.2565, lng: -95.9345 },
  { name: "Des Moines", state: "IA", lat: 41.5868, lng: -93.6250 },
  { name: "Grand Rapids", state: "MI", lat: 42.9634, lng: -85.6681 },
  { name: "Louisville", state: "KY", lat: 38.2527, lng: -85.7585 },
  { name: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301 },

  // South Central
  { name: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715 },
  { name: "Baton Rouge", state: "LA", lat: 30.4515, lng: -91.1871 },
  { name: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164 },
  { name: "Tulsa", state: "OK", lat: 36.1540, lng: -95.9928 },
  { name: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896 },

  // Mountain West
  { name: "Denver", state: "CO", lat: 39.7392, lng: -104.9903 },
  { name: "Colorado Springs", state: "CO", lat: 38.8339, lng: -104.8214 },
  { name: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.8910 },
  { name: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.0740 },
  { name: "Tucson", state: "AZ", lat: 32.2226, lng: -110.9747 },
  { name: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6504 },
  { name: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398 },
  { name: "Boise", state: "ID", lat: 43.6150, lng: -116.2023 },
  { name: "Reno", state: "NV", lat: 39.5296, lng: -119.8138 },

  // Pacific Northwest
  { name: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321 },
  { name: "Portland", state: "OR", lat: 45.5152, lng: -122.6784 },
  { name: "Spokane", state: "WA", lat: 47.6588, lng: -117.4260 },

  // Other
  { name: "Honolulu", state: "HI", lat: 21.3069, lng: -157.8583 },
];

const MAX_METRO_DISTANCE_MILES = 50;

function findNearestMetro(lat: number, lng: number): Metro | null {
  let nearest: Metro | null = null;
  let minDist = Infinity;

  for (const metro of US_METROS) {
    const dist = getDistanceMiles(lat, lng, metro.lat, metro.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = metro;
    }
  }

  return minDist <= MAX_METRO_DISTANCE_MILES ? nearest : null;
}

/**
 * Consolidate per-city summaries into metro-level bubbles.
 * Cities within 50 miles of a known metro are merged.
 * The bubble position is the location-weighted centroid of the actual cities.
 */
export function consolidateToMetros(cities: CitySummary[]): CitySummary[] {
  const metroMap = new Map<string, {
    metro: Metro;
    totalLocs: number;
    totalVotes: number;
    weightedLat: number;
    weightedLng: number;
  }>();

  const unmatched: CitySummary[] = [];

  for (const city of cities) {
    const nearest = findNearestMetro(city.lat, city.lng);
    if (nearest) {
      const key = `${nearest.name}|${nearest.state}`;
      const existing = metroMap.get(key);
      if (existing) {
        existing.totalLocs += city.locationCount;
        existing.totalVotes += city.totalVotes;
        existing.weightedLat += city.lat * city.locationCount;
        existing.weightedLng += city.lng * city.locationCount;
      } else {
        metroMap.set(key, {
          metro: nearest,
          totalLocs: city.locationCount,
          totalVotes: city.totalVotes,
          weightedLat: city.lat * city.locationCount,
          weightedLng: city.lng * city.locationCount,
        });
      }
    } else {
      // City not near any known metro — keep as standalone bubble
      unmatched.push(city);
    }
  }

  const consolidated: CitySummary[] = [];
  for (const [, entry] of metroMap) {
    consolidated.push({
      city: entry.metro.name,
      state: entry.metro.state,
      lat: entry.weightedLat / entry.totalLocs,
      lng: entry.weightedLng / entry.totalLocs,
      locationCount: entry.totalLocs,
      totalVotes: entry.totalVotes,
    });
  }

  return [...consolidated, ...unmatched];
}
