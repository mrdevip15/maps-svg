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
const ZOOM_FACTOR = 0.15;
const MIN_W = 100;
const MAX_W = 600;

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

  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? ZOOM_FACTOR : -ZOOM_FACTOR;
      zoomAt(e.clientX, e.clientY, delta);
    },
    [zoomAt]
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

  return (
    <div className="map-layout">
      <div className="map-container" onMouseMove={tooltip ? moveTooltip : undefined}>
        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="map-svg"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onClick={handleDebugClick}
          style={{ cursor: isPanning.current ? "grabbing" : "grab" }}
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
          <button type="button" className="zoom-btn" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, -ZOOM_FACTOR)} title="Zoom In">+</button>
          <button type="button" className="zoom-btn" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, ZOOM_FACTOR)} title="Zoom Out">−</button>
          <button type="button" className="zoom-btn zoom-reset" onClick={resetZoom} title="Reset">⟲</button>
        </div>

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
