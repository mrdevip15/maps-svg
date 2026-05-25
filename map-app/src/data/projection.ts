/**
 * Calibrated linear projection.
 *
 * Maps geographic coordinates (lat/lng) to absolute SVG user-space coordinates
 * using two calibrated points from the SVG itself:
 *
 * Makassar Losari: lat -5.1441, lng 119.4061 → SVG 528.4, 237.3
 * Parepare:        lat -4.0101, lng 119.6242 → SVG 532.9, 213.9
 *
 * These two points produce almost identical X/Y scale:
 *   Δx / Δlng ≈ 20.63 px/degree
 *   Δy / Δlat ≈ -20.63 px/degree
 *
 * So this SVG behaves like a simple equirectangular map in this region:
 * longitude moves X right, latitude moves Y up.
 */

const ORIGIN = {
  label: "Makassar Losari",
  lat: -5.1441,
  lng: 119.4061,
  x: 528.4,
  y: 237.3,
};

const PAREPARE = {
  label: "Parepare",
  lat: -4.0101,
  lng: 119.6242,
  x: 532.9,
  y: 213.9,
};

const X_SCALE = (PAREPARE.x - ORIGIN.x) / (PAREPARE.lng - ORIGIN.lng);
const Y_SCALE = (PAREPARE.y - ORIGIN.y) / (PAREPARE.lat - ORIGIN.lat);

/**
 * Project lat/lng to absolute SVG x,y.
 */
export function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ORIGIN.x + (lng - ORIGIN.lng) * X_SCALE,
    y: ORIGIN.y + (lat - ORIGIN.lat) * Y_SCALE,
  };
}

/**
 * Reverse projection, useful for debugging/calibration.
 */
export function svgToLatLng(x: number, y: number): { lat: number; lng: number } {
  return {
    lng: ORIGIN.lng + (x - ORIGIN.x) / X_SCALE,
    lat: ORIGIN.lat + (y - ORIGIN.y) / Y_SCALE,
  };
}

export const projectionCalibration = {
  origin: ORIGIN,
  reference: PAREPARE,
  xScale: X_SCALE,
  yScale: Y_SCALE,
};
