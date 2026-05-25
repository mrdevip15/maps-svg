import { useCallback, useMemo, useState, useRef, useEffect, type MouseEvent, type WheelEvent } from "react";
import { eacBranches, type EacBranch } from "../data/eacBranches";
import { pathToProvince } from "../data/provinceMap";
import { projectToSvg } from "../data/projection";

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

const DEFAULT_VB: VB = { x: 500, y: 10, w: 470, h: 320 };
const MIN_W = 40;
const MAX_W = 600;
const BASE_FACTOR = 0.08;

// Zoom precision: multiplier how fine each scroll/slider step is
const ZOOM_PRESETS = { x1: 1, x5: 5, x10: 10 } as const;
type ZoomPreset = keyof typeof ZOOM_PRESETS;

const targetIndices = new Set(Object.keys(pathToProvince).map(Number));

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

function groupBranchesByRegion(branches: EacBranch[]) {
  return branches.reduce<Array<{ region: string; regionCode: string; branches: EacBranch[] }>>(
    (groups, branch) => {
      const group = groups.find((item) => item.regionCode === branch.regionCode);

      if (group) {
        group.branches.push(branch);
      } else {
        groups.push({
          region: branch.region,
          regionCode: branch.regionCode,
          branches: [branch],
        });
      }

      return groups;
    },
    []
  );
}

export default function InteractiveMap() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [svgRaw, setSvgRaw] = useState<string | null>(null);
  const [vb, setVb] = useState<VB>(DEFAULT_VB);
  const [debugPoint, setDebugPoint] = useState<{ x: number; y: number } | null>(null);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [svgOpacity, setSvgOpacity] = useState(0.85);
  const [svgLocked, setSvgLocked] = useState(false);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>("x1");
  const [coordInput, setCoordInput] = useState("");
  const [mapsSync, setMapsSync] = useState(true);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vbX: 0, vbY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  if (typeof window !== "undefined" && !svgRaw) {
    fetch("/all_region.svg")
      .then((r) => r.text())
      .then(setSvgRaw)
      .catch(console.error);
  }

  const paths = useMemo(() => (svgRaw ? parseSvgPaths(svgRaw) : []), [svgRaw]);
  const branchGroups = useMemo(() => groupBranchesByRegion(eacBranches), []);
  const branchesByRegion = useMemo(
    () =>
      eacBranches.reduce<Record<string, EacBranch[]>>((result, branch) => {
        result[branch.regionCode] = [...(result[branch.regionCode] ?? []), branch];
        return result;
      }, {}),
    []
  );

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

  // Zoom slider: maps 0-100 to viewBox width (MAX_W → MIN_W)
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

  const resetZoom = useCallback(() => setVb(DEFAULT_VB), []);

  // Debug coordinate picker
  const handleDebugClick = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width;
      const sy = (e.clientY - rect.top) / rect.height;
      setDebugPoint({ x: vb.x + sx * vb.w, y: vb.y + sy * vb.h });
    },
    [vb]
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

  const handleMarkerEnter = useCallback((branch: EacBranch, e: MouseEvent) => {
    setActiveBranchId(branch.id);
    setTooltip({
      title: `${branch.name}${branch.special ? " ✦" : ""}`,
      lines: [branch.area, branch.region],
      x: e.clientX + 14,
      y: e.clientY - 10,
    });
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setActiveBranchId(null);
    setTooltip(null);
  }, []);

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  // Sync: compute Google Maps zoom level from SVG viewBox width
  // SVG w=470 → GM zoom ~5, w=40 → GM zoom ~16
  const gmZoom = Math.round(5 + (1 - (vb.w - MIN_W) / (MAX_W - MIN_W)) * 11);

  // For future pan sync

  // Default: protobuf embed, no pin, centered on eastern Indonesia
  const mapsUrlDefault = `https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d6367616.0!2d117.5!3d-2.0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sid!4v1`;

  // With marker: simple embed centers on the coordinate + shows pin
  const [markerLat, setMarkerLat] = useState<number | null>(null);
  const [markerLng, setMarkerLng] = useState<number | null>(null);

  const mapsUrlWithMarker = (markerLat !== null && markerLng !== null)
    ? `https://maps.google.com/maps?q=${markerLat},${markerLng}&z=${gmZoom}&output=embed`
    : mapsUrlDefault;

  const handleGoToCoord = useCallback(() => {
    const parts = coordInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setMarkerLat(parts[0]);
      setMarkerLng(parts[1]);
    }
  }, [coordInput]);

  const clearMarker = useCallback(() => {
    setMarkerLat(null);
    setMarkerLng(null);
    setCoordInput("");
  }, []);

  return (
    <div className="map-layout">
      <div className="map-container" onMouseMove={tooltip ? moveTooltip : undefined}>
        {/* Google Maps background for calibration */}
        {calibrationMode && (
          <div className="calibration-bg">
            <iframe
              key={mapsUrlWithMarker}
              src={mapsSync ? mapsUrlWithMarker : mapsUrlDefault}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Maps Satellite"
            />
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

            return (
              <path
                key={index}
                d={d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={1}
                className={isHovered ? "province-active" : undefined}
                style={{
                  cursor: "grab",
                  opacity: isHovered ? 1 : isTarget ? 1 : 0.2,
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={isTarget ? (e) => handleProvinceEnter(index, e) : undefined}
                onMouseLeave={isTarget ? handleProvinceLeave : undefined}
              />
            );
          })}

          {/* All markers always visible */}
          {eacBranches.map((branch) => {
            const isBranchActive = branch.id === activeBranchId;
            const { x: bx, y: by } = projectToSvg(branch.lat, branch.lng);

            return (
              <g
                key={branch.id}
                className={`branch-marker${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                  isBranchActive ? " active" : ""
                }`}
                onMouseEnter={(e) => handleMarkerEnter(branch, e)}
                onMouseLeave={handleMarkerLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveBranchId(branch.id);
                }}
              >
                {branch.highlighted && <circle className="marker-pulse" cx={bx} cy={by} r="8" />}
                <circle
                  cx={bx}
                  cy={by}
                  r={branch.highlighted ? 6 : 4}
                  className="marker-dot"
                />
                {branch.special && !branch.highlighted && (
                  <path
                    className="marker-star"
                    d={`M ${bx} ${by - 8} L ${bx + 4} ${by - 4} L ${bx} ${by} L ${bx - 4} ${by - 4} Z`}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <div className="zoom-preset-group">
            {(["x1", "x5", "x10"] as ZoomPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`zoom-preset-btn${zoomPreset === p ? " active" : ""}`}
                onClick={() => setZoomPreset(p)}
                title={`Zoom precision ${p}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button type="button" className="zoom-btn zoom-reset" onClick={resetZoom} title="Reset">⟲</button>
          <button
            type="button"
            className={`zoom-btn calibrate-btn${calibrationMode ? " active" : ""}`}
            onClick={() => setCalibrationMode((v) => !v)}
            title="Toggle Calibration Mode"
          >🎯</button>
        </div>

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
          <div className="calibration-panel">
            <label className="calibration-label">
              SVG Opacity: <strong>{Math.round(svgOpacity * 100)}%</strong>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={svgOpacity}
              onChange={(e) => setSvgOpacity(parseFloat(e.target.value))}
              className="calibration-slider"
            />

            <div className="calibration-row">
              <button
                type="button"
                className={`sync-toggle${mapsSync ? " active" : ""}`}
                onClick={() => setMapsSync((v) => !v)}
              >
                {mapsSync ? "🔗 Sync zoom ON" : "⛓️ Sync zoom OFF"}
              </button>
            </div>

            <div className="coord-input-group">
              <span className="coord-input-label">📍</span>
              <input
                type="text"
                placeholder="-5.198544, 119.446975"
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGoToCoord()}
                className="coord-input"
              />
              <button type="button" className="coord-go-btn" onClick={handleGoToCoord}>Go</button>
              {markerLat !== null && (
                <button type="button" className="coord-clear-btn" onClick={clearMarker}>×</button>
              )}
            </div>

            <button
              type="button"
              className={`lock-toggle${svgLocked ? " locked" : ""}`}
              onClick={() => setSvgLocked((v) => !v)}
            >
              {svgLocked ? "🔓 Unlock SVG — interaksi Google Maps" : "🔒 Lock SVG — interaksi Google Maps"}
            </button>
            <p className="calibration-hint">
              Sync ON → zoom SVG otomatis sync Google Maps. Lock SVG → pan/zoom Google Maps manual.
            </p>
          </div>
        )}

        <div className="legend" aria-label="Legenda marker cabang">
          <div className="legend-item"><span className="legend-dot regular" /> Cabang reguler</div>
          <div className="legend-item"><span className="legend-dot special" /> Cabang khusus ✦</div>
          <div className="legend-item"><span className="legend-dot highlighted" /> Fokus utama</div>
        </div>

        {/* Debug coordinate picker */}
        {debugPoint && (
          <div className="debug-coords">
            <div className="debug-coords-title">📍 SVG Coords</div>
            <code className="debug-coords-value">{debugPoint.x.toFixed(1)}, {debugPoint.y.toFixed(1)}</code>
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

      <aside className="sidebar" aria-label="Daftar cabang EAC">
        <div className="sidebar-summary">
          <span className="summary-count">{eacBranches.length}</span>
          <span>cabang EAC di Indonesia Timur</span>
        </div>

        <div className="sidebar-hint">Scroll untuk zoom, drag untuk geser. Klik peta untuk koordinat SVG.</div>

        {branchGroups.map((group) => (
          <section className="sidebar-region" key={group.regionCode}>
            <div className="sidebar-region-header">
              <span>{group.region}</span>
              <span>{group.branches.length}</span>
            </div>

            <div className="sidebar-region-list">
              {group.branches.map((branch) => (
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
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </aside>
    </div>
  );
}
