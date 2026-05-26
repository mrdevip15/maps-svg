import { useCallback, useMemo, useState, useRef, useEffect, type MouseEvent, type WheelEvent } from "react";
import { eacBranches, type EacBranch } from "../data/eacBranches";
import { pathToProvince } from "../data/provinceMap";
import { projectToSvg } from "../data/projection";

declare global {
  interface Window {
    google?: any;
    __googleMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsPromise) return window.__googleMapsPromise;

  window.__googleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return window.__googleMapsPromise;
}

interface TooltipData {
  title: string;
  lines: string[];
  x: number;
  y: number;
}

interface SvgPath {
  d: string;
  fill: string;
  index: number;
}

type VB = { x: number; y: number; w: number; h: number };
type FocusTarget =
  | { type: "island"; label: string; regionCodes: string[] }
  | { type: "province"; label: string; regionCodes: string[] }
  | { type: "city"; label: string; regionCodes: string[]; city: string };

interface RefPoint {
  label: string;
  lat: number;
  lng: number;
  svgX: number | null;
  svgY: number | null;
}

const DEFAULT_VB: VB = { x: 500, y: 10, w: 470, h: 320 };
const MIN_W = 8;
const MAX_W = 600;
const BASE_FACTOR = 0.08;

// Zoom precision: multiplier how fine each scroll/slider step is
const ZOOM_PRESETS = { x1: 1, x5: 5, x10: 10 } as const;
type ZoomPreset = keyof typeof ZOOM_PRESETS;

const targetIndices = new Set(Object.keys(pathToProvince).map(Number));

const ISLANDS = [
  { name: "Sulawesi", regionCodes: ["IDSN", "IDST", "IDSG", "IDSA", "IDSR", "IDGO"] },
  { name: "Maluku", regionCodes: ["IDMU", "IDMA"] },
  { name: "Papua", regionCodes: ["IDPB", "IDPA"] },
] as const;

function getIslandForRegionCode(regionCode: string) {
  return ISLANDS.find((island) => (island.regionCodes as readonly string[]).includes(regionCode))?.name ?? "Lainnya";
}

function getBranchSvgPosition(branch: EacBranch) {
  if (branch.svgX !== undefined && branch.svgY !== undefined) {
    return { x: branch.svgX, y: branch.svgY };
  }

  return projectToSvg(branch.lat, branch.lng);
}

function parseSvgPaths(svgText: string): SvgPath[] {
  const regex = /<path[^>]*>/g;
  const results: SvgPath[] = [];
  let match;

  while ((match = regex.exec(svgText)) !== null) {
    const tag = match[0];
    const dMatch = tag.match(/d="([^"]*)"/);
    const fillMatch = tag.match(/fill="([^"]*)"/);

    if (dMatch) {
      results.push({
        d: dMatch[1],
        fill: fillMatch ? fillMatch[1] : "#2d5aa6",
        index: results.length,
      });
    }
  }

  return results;
}

function groupBranchesByIslandProvinceCity(branches: EacBranch[]) {
  return branches.reduce<
    Array<{
      island: string;
      total: number;
      provinces: Array<{
        region: string;
        regionCode: string;
        total: number;
        cities: Array<{ city: string; branches: EacBranch[] }>;
      }>;
    }>
  >((groups, branch) => {
    const island = getIslandForRegionCode(branch.regionCode);
    let islandGroup = groups.find((item) => item.island === island);

    if (!islandGroup) {
      islandGroup = { island, total: 0, provinces: [] };
      groups.push(islandGroup);
    }

    let provinceGroup = islandGroup.provinces.find((item) => item.regionCode === branch.regionCode);

    if (!provinceGroup) {
      provinceGroup = {
        region: branch.region,
        regionCode: branch.regionCode,
        total: 0,
        cities: [],
      };
      islandGroup.provinces.push(provinceGroup);
    }

    let cityGroup = provinceGroup.cities.find((item) => item.city === branch.city);
    if (!cityGroup) {
      cityGroup = { city: branch.city, branches: [] };
      provinceGroup.cities.push(cityGroup);
    }

    cityGroup.branches.push(branch);
    provinceGroup.total += 1;
    islandGroup.total += 1;
    return groups;
  }, []);
}

export default function InteractiveMap() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeRegionIdx, setActiveRegionIdx] = useState<number | null>(null);
  const [activeFocus, setActiveFocus] = useState<FocusTarget | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [svgRaw, setSvgRaw] = useState<string | null>(null);
  const [vb, setVb] = useState<VB>(DEFAULT_VB);
  const [debugPoint, setDebugPoint] = useState<{ x: number; y: number } | null>(null);
  const [calibrationMode] = useState(false);
  const [svgOpacity, setSvgOpacity] = useState(0.85);
  const [svgLocked, setSvgLocked] = useState(false);
  const [syncSvgToMaps, setSyncSvgToMaps] = useState(true);
  const zoomPreset: ZoomPreset = "x1";
  const [gmZoom, setGmZoom] = useState(() => {
    const saved = localStorage.getItem("gmZoom");
    return saved ? parseInt(saved, 10) : 5;
  });
  const [gmCenter, setGmCenter] = useState(() => {
    const saved = localStorage.getItem("gmCenter");
    if (!saved) return { lat: -2.5, lng: 121 };
    try {
      const parsed = JSON.parse(saved) as { lat: number; lng: number };
      return Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng) ? parsed : { lat: -2.5, lng: 121 };
    } catch {
      return { lat: -2.5, lng: 121 };
    }
  });
  const [gmReady, setGmReady] = useState(false);
  const [svgSize, setSvgSize] = useState({ width: 900, height: 600 });

  // Persist gmZoom to localStorage
  useEffect(() => {
    localStorage.setItem("gmZoom", String(gmZoom));
  }, [gmZoom]);

  useEffect(() => {
    localStorage.setItem("gmCenter", JSON.stringify(gmCenter));
  }, [gmCenter]);
  const [bulkInput, setBulkInput] = useState("");

  const handleBulkInput = useCallback((text: string) => {
    setBulkInput(text);
    const lines = text.trim().split("\n").filter((l) => l.trim());
    const parsed: RefPoint[] = lines.map((line, i) => {
      const segments = line.split(",").map((s) => s.trim());
      const labelPart = segments[0];
      const numParts = segments.slice(1).map((s) => parseFloat(s));
      const hasLabel = isNaN(parseFloat(labelPart));
      return {
        label: hasLabel ? labelPart : `Point ${i + 1}`,
        lat: hasLabel ? (isNaN(numParts[0]) ? 0 : numParts[0]) : (isNaN(parseFloat(labelPart)) ? 0 : parseFloat(labelPart)),
        lng: hasLabel ? (isNaN(numParts[1]) ? 0 : numParts[1]) : (isNaN(numParts[0]) ? 0 : parseFloat(labelPart)),
        svgX: null,
        svgY: null,
      };
    });
    setRefPoints(parsed);
    setActiveRefIdx(0);
  }, []);
  const [refPoints, setRefPoints] = useState<RefPoint[]>([]);
  const [activeRefIdx, setActiveRefIdx] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vbX: 0, vbY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Record<number, SVGPathElement | null>>({});
  const googleMapElRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);

  const gmZoomIn = useCallback(() => setGmZoom((z) => Math.min(18, z + 1)), []);
  const gmZoomOut = useCallback(() => setGmZoom((z) => Math.max(1, z - 1)), []);

  const centerSvgOnLatLng = useCallback((lat: number, lng: number) => {
    const { x, y } = projectToSvg(lat, lng);
    setVb((prev) => ({
      ...prev,
      x: x - prev.w / 2,
      y: y - prev.h / 2,
    }));
  }, []);

  const focusSvgBounds = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    const aspect = DEFAULT_VB.w / DEFAULT_VB.h;
    const padding = Math.max(8, Math.max(bounds.width, bounds.height) * 0.14);
    const paddedW = bounds.width + padding * 2;
    const paddedH = bounds.height + padding * 2;
    const nextW = Math.min(MAX_W, Math.max(MIN_W, Math.max(paddedW, paddedH * aspect)));
    const nextH = nextW / aspect;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;

    setVb({
      x: cx - nextW / 2,
      y: cy - nextH / 2,
      w: nextW,
      h: nextH,
    });
  }, []);

  const focusRegionCodes = useCallback((regionCodes: string[]) => {
    const boxes = Object.entries(pathRefs.current)
      .filter(([index, el]) => el && regionCodes.includes(pathToProvince[Number(index)]))
      .map(([, el]) => el!.getBBox());

    if (boxes.length === 0) return;
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    focusSvgBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }, [focusSvgBounds]);

  const focusBranches = useCallback((branches: EacBranch[]) => {
    const points = branches.map(getBranchSvgPosition);
    if (points.length === 0) return;
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    focusSvgBounds({
      x: minX,
      y: minY,
      width: Math.max(4, maxX - minX),
      height: Math.max(4, maxY - minY),
    });
  }, [focusSvgBounds]);

  // --- Bulk calibration hooks ---
  const goToRef = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < refPoints.length) setActiveRefIdx(idx);
    },
    [refPoints.length]
  );

  const referenceOutput = useMemo(
    () =>
      refPoints
        .map(
          (rp) =>
            `${rp.label}, ${rp.lat}, ${rp.lng}, ${rp.svgX !== null ? rp.svgX.toFixed(1) : "?"}, ${rp.svgY !== null ? rp.svgY.toFixed(1) : "?"}`
        )
        .join("\n"),
    [refPoints]
  );

  const copyReference = useCallback(() => {
    navigator.clipboard.writeText(referenceOutput);
  }, [referenceOutput]);

  if (typeof window !== "undefined" && !svgRaw) {
    fetch(`${import.meta.env.BASE_URL}all_region.svg`)
      .then((r) => r.text())
      .then(setSvgRaw)
      .catch(console.error);
  }

  const paths = useMemo(() => (svgRaw ? parseSvgPaths(svgRaw) : []), [svgRaw]);
  const branchGroups = useMemo(() => groupBranchesByIslandProvinceCity(eacBranches), []);
  const branchesByRegion = useMemo(
    () =>
      eacBranches.reduce<Record<string, EacBranch[]>>((result, branch) => {
        result[branch.regionCode] = [...(result[branch.regionCode] ?? []), branch];
        return result;
      }, {}),
    []
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const updateSize = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSvgSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [calibrationMode]);

  const projectedBranches = useMemo(() => {
    const positioned = eacBranches.map((branch) => {
      const { x, y } = getBranchSvgPosition(branch);
      return { branch, x, y };
    });

    const pxPerSvgX = svgSize.width / vb.w;
    const pxPerSvgY = svgSize.height / vb.h;
    const pxPerSvg = (pxPerSvgX + pxPerSvgY) / 2;

    return positioned.map((item, idx) => {
      let nearestPx = Number.POSITIVE_INFINITY;

      positioned.forEach((other, otherIdx) => {
        if (idx === otherIdx) return;
        const dx = (item.x - other.x) * pxPerSvgX;
        const dy = (item.y - other.y) * pxPerSvgY;
        nearestPx = Math.min(nearestPx, Math.hypot(dx, dy));
      });

      const close = nearestPx < 28;
      const radiusPx = 7;

      return {
        ...item,
        nearestPx,
        dimmed:
          activeFocus !== null &&
          !activeFocus.regionCodes.includes(item.branch.regionCode) ||
          (activeFocus?.type === "city" && item.branch.city !== activeFocus.city),
        compact: close,
        radius: radiusPx / pxPerSvg,
        activeRadius: radiusPx / pxPerSvg,
        strokeWidth: 2,
        showAdornment: !close,
      };
    });
  }, [activeFocus, svgSize.height, svgSize.width, vb.h, vb.w]);

  // Zoom centered on mouse position
  const zoomAt = useCallback((screenX: number, screenY: number, factor: number) => {
    setVb((prev) => {
      const svg = svgRef.current;
      if (!svg) return prev;
      const rect = svg.getBoundingClientRect();
      const rx = (screenX - rect.left) / rect.width;
      const ry = (screenY - rect.top) / rect.height;
      const pivotX = prev.x + rx * prev.w;
      const pivotY = prev.y + ry * prev.h;
      const newW = Math.min(MAX_W, Math.max(MIN_W, prev.w * (1 - factor)));
      const scale = newW / prev.w;
      const newH = prev.h * scale;
      return {
        x: pivotX - rx * newW,
        y: pivotY - ry * newH,
        w: newW,
        h: newH,
      };
    });
  }, []);

  // Zoom slider: maps 0-100 to viewBox width (MAX_W → MIN_W) — SVG only
  const handleSliderZoom = useCallback((value: number) => {
    setVb((prev) => {
      const newW = MAX_W - (value / 100) * (MAX_W - MIN_W);
      const scale = newW / prev.w;
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return {
        x: cx - (prev.w / 2) * scale,
        y: cy - (prev.h / 2) * scale,
        w: newW,
        h: prev.h * scale,
      };
    });
  }, []);

  const sliderValue = Math.round(((MAX_W - vb.w) / (MAX_W - MIN_W)) * 100);

  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = BASE_FACTOR * ZOOM_PRESETS[zoomPreset];
      const delta = e.deltaY > 0 ? factor : -factor;
      zoomAt(e.clientX, e.clientY, delta);
    },
    [zoomAt, zoomPreset]
  );

  // Pan
  const handleMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, vbX: vb.x, vbY: vb.y };
  }, [vb.x, vb.y]);

  useEffect(() => {
    const handleMove = (e: globalThis.MouseEvent) => {
      if (!isPanning.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxSvg = ((e.clientX - panStart.current.mx) / rect.width) * vb.w;
      const dySvg = ((e.clientY - panStart.current.my) / rect.height) * vb.h;
      setVb((prev) => ({
        ...prev,
        x: panStart.current.vbX - dxSvg,
        y: panStart.current.vbY - dySvg,
      }));
    };
    const handleUp = () => { isPanning.current = false; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [vb.w, vb.h]);

  const resetZoom = useCallback(() => {
    setVb(DEFAULT_VB);
    setActiveRegionIdx(null);
    setActiveFocus(null);
  }, []);

  // Debug coordinate picker — uses SVG's own CTM for absolute coordinates (pan/zoom independent)
  const handleDebugClick = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const point = new DOMPoint(e.clientX, e.clientY);
      const svgPoint = point.matrixTransform(ctm.inverse());
      const svgX = svgPoint.x;
      const svgY = svgPoint.y;
      setDebugPoint({ x: svgX, y: svgY });

      if (calibrationMode && refPoints[activeRefIdx]) {
        setRefPoints((prev) =>
          prev.map((rp, i) =>
            i === activeRefIdx ? { ...rp, svgX, svgY } : rp
          )
        );
      }
    },
    [calibrationMode, activeRefIdx, refPoints]
  );

  const moveTooltip = useCallback((e: MouseEvent) => {
    setTooltip((prev) => (prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 10 } : null));
  }, []);

  const handleProvinceEnter = useCallback(
    (idx: number, e: MouseEvent) => {
      const regionCode = pathToProvince[idx];
      const regionBranches = regionCode ? branchesByRegion[regionCode] : undefined;

      if (regionCode && regionBranches?.length) {
        setHoveredIdx(idx);
        setTooltip({
          title: regionBranches[0].region,
          lines: [`${regionBranches.length} cabang EAC`],
          x: e.clientX + 14,
          y: e.clientY - 10,
        });
      }
    },
    [branchesByRegion]
  );

  const handleProvinceLeave = useCallback(() => {
    setHoveredIdx(null);
    setTooltip(null);
  }, []);

  const handleRegionClick = useCallback(
    (idx: number, e: MouseEvent<SVGPathElement>) => {
      if (calibrationMode) return;
      if (!targetIndices.has(idx)) return;

      e.stopPropagation();
      const regionCode = pathToProvince[idx];
      const bbox = e.currentTarget.getBBox();
      focusSvgBounds(bbox);
      setActiveRegionIdx(idx);
      if (regionCode) {
        const provinceName = eacBranches.find((branch) => branch.regionCode === regionCode)?.region ?? regionCode;
        setActiveFocus({ type: "province", label: provinceName, regionCodes: [regionCode] });
      }
    },
    [calibrationMode, focusSvgBounds]
  );

  const handleMarkerEnter = useCallback((branch: EacBranch, e: MouseEvent) => {
    setActiveBranchId(branch.id);
    setTooltip({
      title: `${branch.name}${branch.special ? " ✦" : ""}`,
      lines: [branch.area, branch.locationDetail ?? branch.city, `${branch.city}, ${branch.region}`],
      x: e.clientX + 14,
      y: e.clientY - 10,
    });
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setActiveBranchId(null);
    setTooltip(null);
  }, []);

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  // Google Maps JS API: one map instance, no iframe reload between pins.
  useEffect(() => {
    if (!calibrationMode || !googleMapElRef.current || googleMapRef.current) return;

    const apiKey = import.meta.env.VITE_GMAPS_KEY;
    if (!apiKey) return;

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !googleMapElRef.current || googleMapRef.current) return;

        const map = new window.google.maps.Map(googleMapElRef.current, {
          center: gmCenter,
          zoom: gmZoom,
          mapTypeId: "roadmap",
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: false,
        });

        map.addListener("zoom_changed", () => {
          const nextZoom = map.getZoom();
          if (typeof nextZoom === "number") setGmZoom(nextZoom);
        });

        map.addListener("idle", () => {
          const center = map.getCenter();
          if (center) setGmCenter({ lat: center.lat(), lng: center.lng() });
        });

        googleMapRef.current = map;
        setGmReady(true);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [calibrationMode, gmCenter, gmZoom]);

  useEffect(() => {
    if (!gmReady || !googleMapRef.current) return;
    const currentZoom = googleMapRef.current.getZoom();
    if (currentZoom !== gmZoom) googleMapRef.current.setZoom(gmZoom);
  }, [gmReady, gmZoom]);

  useEffect(() => {
    if (!gmReady || !googleMapRef.current || !window.google?.maps) return;

    googleMarkersRef.current.forEach((marker) => marker.setMap(null));
    googleMarkersRef.current = refPoints.map((rp, i) =>
      new window.google.maps.Marker({
        map: googleMapRef.current,
        position: { lat: rp.lat, lng: rp.lng },
        label: `${i + 1}`,
        title: rp.label,
      })
    );
  }, [gmReady, refPoints]);

  useEffect(() => {
    if (!gmReady || !googleMapRef.current) return;
    const rp = refPoints[activeRefIdx];
    if (!rp) return;
    googleMapRef.current.panTo({ lat: rp.lat, lng: rp.lng });

    if (syncSvgToMaps) centerSvgOnLatLng(rp.lat, rp.lng);

    googleMarkersRef.current.forEach((marker, i) => {
      marker.setAnimation(i === activeRefIdx ? window.google.maps.Animation.BOUNCE : null);
      marker.setZIndex(i === activeRefIdx ? 999 : undefined);
    });
  }, [gmReady, refPoints, activeRefIdx, syncSvgToMaps, centerSvgOnLatLng]);

  const copyDebugCoord = useCallback(() => {
    if (!debugPoint) return;
    navigator.clipboard.writeText(`${debugPoint.x.toFixed(1)}, ${debugPoint.y.toFixed(1)}`);
  }, [debugPoint]);

  const mapBreadcrumb = useMemo(() => {
    if (!activeFocus) return ["Indonesia Timur"];

    if (activeFocus.type === "island") return [activeFocus.label];
    if (activeFocus.type === "province") {
      return [getIslandForRegionCode(activeFocus.regionCodes[0]), activeFocus.label];
    }

    return [getIslandForRegionCode(activeFocus.regionCodes[0]), activeFocus.label];
  }, [activeFocus]);

  return (
    <div className="map-layout">
      <div className="map-container" onMouseMove={tooltip ? moveTooltip : undefined}>
        <div className="map-breadcrumb" aria-label="Posisi peta saat ini">
          {mapBreadcrumb.map((item, index) => (
            <span className="map-breadcrumb-item" key={`${item}-${index}`}>
              {index > 0 && <span className="map-breadcrumb-separator">/</span>}
              {item}
            </span>
          ))}
        </div>

        <div className="map-viewport">
        {/* Google Maps background for calibration */}
        {calibrationMode && (
          <div className="calibration-bg">
            <div ref={googleMapElRef} className="google-map-js" />
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="map-svg"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onClick={handleDebugClick}
          style={{
            cursor: svgLocked ? "default" : isPanning.current ? "grabbing" : "grab",
            opacity: calibrationMode ? svgOpacity : 1,
            background: calibrationMode ? "transparent" : undefined,
            pointerEvents: svgLocked ? "none" : undefined,
          }}
        >
          {paths.map(({ d, fill, index }) => {
            const isTarget = targetIndices.has(index);
            const isHovered = index === hoveredIdx;
            const isActiveRegion = index === activeRegionIdx;
            const provinceCode = pathToProvince[index];
            const isFocusedProvince = Boolean(provinceCode && activeFocus?.regionCodes.includes(provinceCode));
            const hasActiveFocus = activeFocus !== null;
            const provinceOpacity = hasActiveFocus
              ? isFocusedProvince
                ? 1
                : isHovered
                  ? 0.72
                  : isTarget
                    ? 0.22
                    : 0.08
              : isHovered
                ? 1
                : isTarget
                  ? 1
                  : 0.2;

            return (
              <path
                key={index}
                ref={(el) => { pathRefs.current[index] = el; }}
                d={d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className={isHovered || isActiveRegion || isFocusedProvince ? "province-active" : undefined}
                style={{
                  cursor: "grab",
                  opacity: provinceOpacity,
                  transition: "opacity 0.2s ease, filter 0.2s ease",
                  filter: isFocusedProvince ? "drop-shadow(0 0 5px rgba(255,255,255,0.45))" : undefined,
                }}
                onMouseEnter={isTarget ? (e) => handleProvinceEnter(index, e) : undefined}
                onMouseLeave={isTarget ? handleProvinceLeave : undefined}
                onClick={isTarget ? (e) => handleRegionClick(index, e) : undefined}
              />
            );
          })}

          {/* Projected branch markers — adaptive size based on current SVG zoom */}
          {projectedBranches.map(({ branch, x: bx, y: by, radius, activeRadius, strokeWidth, showAdornment, compact, dimmed }) => {
            const isBranchActive = branch.id === activeBranchId;

            return (
              <g
                key={branch.id}
                className={`branch-marker${compact ? " compact" : ""}${dimmed ? " dimmed" : ""}${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                  isBranchActive ? " active" : ""
                }`}
                onMouseEnter={(e) => handleMarkerEnter(branch, e)}
                onMouseLeave={handleMarkerLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveBranchId(branch.id);
                }}
              >
                {branch.highlighted && showAdornment && <circle className="marker-pulse" cx={bx} cy={by} r={radius * 1.9} />}
                <circle
                  cx={bx}
                  cy={by}
                  r={isBranchActive ? activeRadius : radius}
                  strokeWidth={strokeWidth}
                  vectorEffect="non-scaling-stroke"
                  className="marker-dot"
                />
                {branch.special && !branch.highlighted && showAdornment && (
                  <path
                    className="marker-star"
                    vectorEffect="non-scaling-stroke"
                    d={`M ${bx} ${by - radius * 2} L ${bx + radius} ${by - radius} L ${bx} ${by} L ${bx - radius} ${by - radius} Z`}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Zoom controls */}
        <div className="zoom-controls" />

        {/* Horizontal zoom slider */}
        <div className="zoom-slider-wrap">
          <span className="zoom-slider-label">−</span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={(e) => handleSliderZoom(parseInt(e.target.value))}
            className="zoom-slider"
            title="Zoom Level"
          />
          <span className="zoom-slider-label">+</span>
        </div>

        {/* Calibration controls */}
        {calibrationMode && (
          <div
            className="calibration-panel"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calibration-title">🎯 Calibration Mode</div>

            <label className="calibration-label">
              Paste titik referensi (label, lat, lng):
            </label>
            <textarea
              className="bulk-textarea"
              placeholder={"Makassar Losari, -5.1441, 119.4061\nManado, 1.4870, 124.8252\n..."}
              value={bulkInput}
              onChange={(e) => handleBulkInput(e.target.value)}
              rows={6}
            />

            {refPoints.length > 0 && (
              <div className="calibration-nav">
                <span className="cal-step">
                  Titik <strong>{activeRefIdx + 1}</strong>/{refPoints.length}: <strong>{refPoints[activeRefIdx].label}</strong>
                </span>
                <div className="cal-nav-btns">
                  <button type="button" className="cal-nav-btn" disabled={activeRefIdx === 0} onClick={() => goToRef(activeRefIdx - 1)}>← Prev</button>
                  <button type="button" className="cal-nav-btn" disabled={activeRefIdx === refPoints.length - 1} onClick={() => goToRef(activeRefIdx + 1)}>Next →</button>
                </div>
                <span className="cal-target">
                  📍 {refPoints[activeRefIdx].lat}, {refPoints[activeRefIdx].lng}
                </span>
                <div className="cal-status">
                  {refPoints[activeRefIdx].svgX !== null ? (
                    <span className="cal-done">✅ Recorded: ({refPoints[activeRefIdx].svgX!.toFixed(1)}, {refPoints[activeRefIdx].svgY!.toFixed(1)})</span>
                  ) : (
                    <span className="cal-pending">⏳ Klik posisi ini di SVG</span>
                  )}
                </div>
              </div>
            )}

            <label className="calibration-label">
              SVG Opacity: <strong>{Math.round(svgOpacity * 100)}%</strong>
            </label>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={svgOpacity}
              onChange={(e) => setSvgOpacity(parseFloat(e.target.value))}
              className="calibration-slider"
            />

            <div className="gm-zoom-row">
              <span className="gm-zoom-label">Maps zoom:</span>
              <button type="button" className="gm-zoom-btn" onClick={gmZoomOut}>−</button>
              <span className="gm-zoom-value">{gmZoom}</span>
              <button type="button" className="gm-zoom-btn" onClick={gmZoomIn}>+</button>
            </div>

            <button
              type="button"
              className={`sync-toggle${syncSvgToMaps ? " active" : ""}`}
              onClick={() => setSyncSvgToMaps((v) => !v)}
            >
              {syncSvgToMaps ? "🔗 SVG sync ON" : "⛓️ SVG sync OFF"}
            </button>

            <button
              type="button"
              className={`lock-toggle${svgLocked ? " locked" : ""}`}
              onClick={() => setSvgLocked((v) => !v)}
            >
              {svgLocked ? "🔓 Unlock SVG" : "🔒 Lock SVG — interaksi Google Maps"}
            </button>

            {refPoints.length > 0 && (
              <div className="cal-progress">
                <div className="cal-progress-bar">
                  {refPoints.map((rp, i) => (
                    <div key={i} className={`cal-progress-seg${i === activeRefIdx ? " active" : ""}${rp.svgX !== null ? " done" : ""}`} />
                  ))}
                </div>
                <span className="cal-progress-text">
                  {refPoints.filter((rp) => rp.svgX !== null).length}/{refPoints.length} recorded
                </span>
              </div>
            )}

            {refPoints.length > 0 && refPoints.every((rp) => rp.svgX !== null) && (
              <div className="cal-copy-section">
                <div className="cal-copy-label">✅ Semua titik tercatat! Copy hasil:</div>
                <pre className="cal-output">{referenceOutput}</pre>
                <button type="button" className="cal-copy-btn" onClick={copyReference}>📋 Copy</button>
              </div>
            )}

            <p className="calibration-hint">
              1. Paste titik → 2. Prev/Next → 3. Klik posisi di SVG → 4. Copy
            </p>
          </div>
        )}

       

        {/* Debug coordinate picker */}
        {debugPoint && (
          <div className="debug-coords">
            <div className="debug-coords-title">📍 SVG Coords</div>
            <code className="debug-coords-value" onClick={copyDebugCoord} title="Klik untuk copy">{debugPoint.x.toFixed(1)}, {debugPoint.y.toFixed(1)}</code>
            <button className="debug-coords-copy" onClick={copyDebugCoord} title="Copy">📋</button>
            <button className="debug-coords-close" onClick={() => setDebugPoint(null)}>×</button>
          </div>
        )}

        {tooltip && (
          <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="tooltip-name">{tooltip.title}</div>
            {tooltip.lines.map((line) => (
              <div className="tooltip-pop" key={line}>{line}</div>
            ))}
          </div>
        )}
        </div>
      </div>

      <aside className="sidebar" aria-label="Daftar cabang EAC">
        <div className="sidebar-summary">
          <span className="summary-count">{eacBranches.length}</span>
          <span>cabang EAC di Indonesia Timur</span>
        </div>

        <div className="sidebar-hint">Scroll untuk zoom, drag untuk geser. Klik peta untuk koordinat SVG.</div>

        {activeFocus && (
          <button type="button" className="sidebar-clear-focus" onClick={resetZoom}>
            Clear focus: {activeFocus.label}
          </button>
        )}

        {branchGroups.map((islandGroup) => (
          <details className="sidebar-region sidebar-island" key={islandGroup.island}>
            <summary
              className="sidebar-region-header"
              onClick={() => {
                  const island = ISLANDS.find((item) => item.name === islandGroup.island);
                  const regionCodes = island ? [...island.regionCodes] : islandGroup.provinces.map((province) => province.regionCode);
                  setActiveFocus({ type: "island", label: islandGroup.island, regionCodes });
                  setActiveRegionIdx(null);
                  focusRegionCodes(regionCodes);
              }}
            >
              <span className="sidebar-focus-label">
                {islandGroup.island}
              </span>
              <span>{islandGroup.total}</span>
            </summary>

            <div className="sidebar-region-list">
              {islandGroup.provinces.map((provinceGroup) => (
                <details className="sidebar-province" key={provinceGroup.regionCode}>
                  <summary
                    className="sidebar-province-header"
                    onClick={() => {
                        setActiveFocus({ type: "province", label: provinceGroup.region, regionCodes: [provinceGroup.regionCode] });
                        setActiveRegionIdx(null);
                        focusRegionCodes([provinceGroup.regionCode]);
                    }}
                  >
                    <span className="sidebar-focus-label">
                      {provinceGroup.region}
                    </span>
                    <span>{provinceGroup.total}</span>
                  </summary>

                  {provinceGroup.cities.map((cityGroup) => (
                    <details className="sidebar-city" key={`${provinceGroup.regionCode}-${cityGroup.city}`}>
                      <summary
                        className="sidebar-city-header"
                        onClick={() => {
                            setActiveFocus({
                              type: "city",
                              label: cityGroup.city,
                              regionCodes: [provinceGroup.regionCode],
                              city: cityGroup.city,
                            });
                            setActiveRegionIdx(null);
                            focusBranches(cityGroup.branches);
                        }}
                      >
                        <span className="sidebar-focus-label">
                          {cityGroup.city}
                        </span>
                        <span>{cityGroup.branches.length}</span>
                      </summary>

                      {cityGroup.branches.map((branch) => (
                        <button
                          type="button"
                          key={branch.id}
                          className={`sidebar-branch${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                            activeBranchId === branch.id ? " active" : ""
                          }`}
                          onMouseEnter={() => setActiveBranchId(branch.id)}
                          onMouseLeave={() => setActiveBranchId(null)}
                          onFocus={() => setActiveBranchId(branch.id)}
                          onBlur={() => setActiveBranchId(null)}
                        >
                          <span className="branch-number">{branch.id}</span>
                          <span className="branch-text">
                            <span className="branch-name">{branch.name}{branch.special ? " ✦" : ""}</span>
                            <span className="branch-area">{branch.area}</span>
                            {branch.locationDetail && <span className="branch-location">{branch.locationDetail}</span>}
                          </span>
                        </button>
                      ))}
                    </details>
                  ))}
                </details>
              ))}
            </div>
          </details>
        ))}
      </aside>
    </div>
  );
}
