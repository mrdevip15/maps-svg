export interface EacBranch {
  id: number;
  name: string;
  area: string;
  region: string;
  regionCode: string;
  lat: number;
  lng: number;
  special: boolean;
  highlighted: boolean;
}

/**
 * Branch data with real lat/lng coordinates.
 * SVG x/y are computed at runtime via projection.ts (IDW).
 *
 * To add a new branch: add lat/lng here — no manual SVG coords needed.
 */
export const eacBranches: EacBranch[] = [
  // === Sulawesi Selatan ===
  {
    id: 1,
    name: "Gowa",
    area: "English Academy Center",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -5.198544,
    lng: 119.446975,
    special: false,
    highlighted: false,
  },
  {
    id: 2,
    name: "Makassar Baruga",
    area: "Brain Academy Ruangguru",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -5.157012,
    lng: 119.485224,
    special: false,
    highlighted: false,
  },
  {
    id: 3,
    name: "Makassar Cendrawasih",
    area: "English Academy Center",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -5.149199,
    lng: 119.412927,
    special: false,
    highlighted: false,
  },
  {
    id: 4,
    name: "Makassar Hertasning",
    area: "English Academy Center",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -5.163132,
    lng: 119.444094,
    special: false,
    highlighted: false,
  },
  {
    id: 5,
    name: "Makassar Sudiang",
    area: "English Academy Center",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -5.074558,
    lng: 119.522786,
    special: false,
    highlighted: false,
  },
  {
    id: 6,
    name: "Palopo Andi Kambo",
    area: "English Academy Center",
    region: "Sulawesi Selatan",
    regionCode: "IDSN",
    lat: -3.003306,
    lng: 120.200885,
    special: false,
    highlighted: false,
  },
];
