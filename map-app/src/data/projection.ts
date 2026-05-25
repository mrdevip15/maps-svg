/**
 * Inverse Distance Weighting (IDW) projection.
 * Maps geographic coordinates (lat, lng) → SVG coordinates (x, y)
 * using known reference points from province SVG path centroids.
 *
 * Reference points: (svgX, svgY, lng, lat) — province centroid in SVG space
 * paired with approximate geographic center of each province.
 */

interface RefPoint {
  sx: number;
  sy: number;
  lng: number;
  lat: number;
}

// Province SVG centroids computed from all_region.svg path data
// Geographic centers are approximate province midpoints
const REFERENCE_POINTS: RefPoint[] = [
  { sx: 584.6, sy: 120.6, lng: 123.1, lat: 0.5 },   // Gorontalo
  { sx: 545.3, sy: 219.6, lng: 120.0, lat: -3.7 },  // Sulawesi Selatan
  { sx: 589.0, sy: 224.0, lng: 122.5, lat: -4.0 },  // Sulawesi Tenggara
  { sx: 640.3, sy: 92.0,  lng: 124.8, lat: 0.8 },   // Sulawesi Utara
  { sx: 574.9, sy: 150.1, lng: 121.5, lat: -1.4 },  // Sulawesi Tengah
  { sx: 526.7, sy: 181.7, lng: 118.9, lat: -2.5 },  // Sulawesi Barat
  { sx: 685.3, sy: 136.3, lng: 127.0, lat: 1.6 },   // Maluku Utara
  { sx: 750.9, sy: 248.2, lng: 128.8, lat: -3.4 },  // Maluku
  { sx: 784.5, sy: 171.8, lng: 132.0, lat: -2.5 },  // Papua Barat
  { sx: 890.3, sy: 223.8, lng: 138.5, lat: -4.0 },  // Papua
];

/**
 * Project lat/lng to SVG x,y using Inverse Distance Weighting.
 * @param lat - Latitude (negative for south)
 * @param lng - Longitude (positive for east)
 * @returns SVG coordinates {x, y}
 */
export function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  const power = 2;
  let totalW = 0;
  let sumX = 0;
  let sumY = 0;

  for (const { sx, sy, lng: rlng, lat: rlat } of REFERENCE_POINTS) {
    const dist = Math.sqrt((lng - rlng) ** 2 + (lat - rlat) ** 2);
    if (dist < 1e-6) return { x: sx, y: sy };
    const w = 1 / dist ** power;
    totalW += w;
    sumX += w * sx;
    sumY += w * sy;
  }

  return {
    x: sumX / totalW,
    y: sumY / totalW,
  };
}
