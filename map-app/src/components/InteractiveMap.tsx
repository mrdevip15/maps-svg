import { useCallback, useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
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

const DEFAULT_VB = { x: 500, y: 10, w: 470, h: 320 };

const targetIndices = new Set(Object.keys(pathToProvince).map(Number));

// Province path indices grouped by region code for click-outside detection
const provinceIndexByCode = new Map<string, number>();
for (const [idx, code] of Object.entries(pathToProvince)) {
  provinceIndexByCode.set(code, Number(idx));
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

/** Extract all coordinate points from an SVG path `d` attribute. */
function extractPathPoints(d: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  // Match all number sequences after path commands (M, L, C, Q, S, T, A, Z)
  const re = /[\d.\-]+/g;
  let m: RegExpExecArray | null;
  const nums: number[] = [];
  while ((m = re.exec(d)) !== null) {
    nums.push(parseFloat(m[0]));
  }
  for (let i = 0; i < nums.length - 1; i += 2) {
    pts.push([nums[i], nums[i + 1]]);
  }
  return pts;
}

/** Compute a viewBox centered on a province SVG path's bounding box. */
function pathViewBox(d: string): { x: number; y: number; w: number; h: number } {
  const pts = extractPathPoints(d);
  if (pts.length === 0) return DEFAULT_VB;

  const padding = 24;
  const minX = Math.min(...pts.map((p) => p[0])) - padding;
  const maxX = Math.max(...pts.map((p) => p[0])) + padding;
  const minY = Math.min(...pts.map((p) => p[1])) - padding;
  const maxY = Math.max(...pts.map((p) => p[1])) + padding;

  // Maintain aspect ratio matching the default viewBox
  const w = maxX - minX;
  const h = maxY - minY;
  const targetAspect = DEFAULT_VB.w / DEFAULT_VB.h;
  let finalW = w;
  let finalH = h;

  if (w / h > targetAspect) {
    finalH = w / targetAspect;
  } else {
    finalW = h * targetAspect;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    x: cx - finalW / 2,
    y: cy - finalH / 2,
    w: finalW,
    h: finalH,
  };
}

export default function InteractiveMap() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [svgRaw, setSvgRaw] = useState<string | null>(null);
  const [currentVB, setCurrentVB] = useState(DEFAULT_VB);
  const animRef = useRef<number | null>(null);

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

  // Pre-compute viewboxes per region from the province SVG path shape
  const viewBoxByRegion = useMemo(() => {
    const map: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [code, pathIdx] of provinceIndexByCode) {
      const p = paths[pathIdx];
      if (p) map[code] = pathViewBox(p.d);
    }
    return map;
  }, [paths]);

  // Smoothly animate viewBox transition
  useEffect(() => {
    const target = selectedRegionCode ? viewBoxByRegion[selectedRegionCode] : DEFAULT_VB;

    const animate = () => {
      setCurrentVB((prev) => {
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const dw = target.w - prev.w;
        const dh = target.h - prev.h;

        if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 && Math.abs(dw) < 0.3 && Math.abs(dh) < 0.3) {
          return target;
        }

        return {
          x: prev.x + dx * 0.12,
          y: prev.y + dy * 0.12,
          w: prev.w + dw * 0.12,
          h: prev.h + dh * 0.12,
        };
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [selectedRegionCode, viewBoxByRegion]);

  const selectedBranches = useMemo(
    () => (selectedRegionCode ? branchesByRegion[selectedRegionCode] ?? [] : []),
    [selectedRegionCode, branchesByRegion]
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

  const handleProvinceClick = useCallback((idx: number) => {
    const regionCode = pathToProvince[idx];
    if (regionCode) {
      setSelectedRegionCode((current) => (current === regionCode ? null : regionCode));
    }
  }, []);

  // Click on SVG background (non-province) to deselect
  const handleSvgBgClick = useCallback((e: MouseEvent<SVGSVGElement>) => {
    // Only if clicking directly on the svg or a non-target path
    const target = e.target as SVGElement;
    if (target.tagName === "svg" || target.tagName === "rect") {
      setSelectedRegionCode(null);
    }
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

  const toggleRegion = useCallback((regionCode: string) => {
    setSelectedRegionCode((current) => (current === regionCode ? null : regionCode));
  }, []);

  const viewBoxStr = `${currentVB.x} ${currentVB.y} ${currentVB.w} ${currentVB.h}`;

  return (
    <div className="map-layout">
      <div className="map-container" onMouseMove={tooltip ? moveTooltip : undefined}>
        <svg
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="map-svg"
          onClick={handleSvgBgClick}
        >
          {paths.map(({ d, fill, index }) => {
            const regionCode = pathToProvince[index];
            const isTarget = targetIndices.has(index);
            const isSelected = selectedRegionCode !== null && regionCode === selectedRegionCode;
            const isHovered = index === hoveredIdx;
            const isDimmed = selectedRegionCode !== null && regionCode !== selectedRegionCode;

            return (
              <path
                key={index}
                d={d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={1.5}
                className={isSelected || isHovered ? "province-active" : undefined}
                style={{
                  cursor: isTarget ? "pointer" : "default",
                  opacity: selectedRegionCode !== null
                    ? isSelected ? 1 : isTarget ? 0.25 : 0.1
                    : isTarget ? 1 : 0.2,
                  filter: isDimmed ? "grayscale(0.3)" : undefined,
                  transition: "opacity 0.3s ease, filter 0.3s ease",
                }}
                onMouseEnter={isTarget ? (e) => handleProvinceEnter(index, e) : undefined}
                onMouseLeave={isTarget ? handleProvinceLeave : undefined}
                onClick={isTarget ? (e) => {
                  e.stopPropagation();
                  handleProvinceClick(index);
                } : undefined}
              />
            );
          })}

          {/* Only show markers when a region is selected */}
          {selectedBranches.map((branch, i) => {
            const isBranchActive = branch.id === activeBranchId;
            const { x: bx, y: by } = projectToSvg(branch.lat, branch.lng);

            return (
              <g
                key={branch.id}
                className={`branch-marker${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                  isBranchActive ? " active" : ""
                }`}
                style={{ opacity: 1, animation: `marker-appear 0.3s ${i * 0.05}s ease both` }}
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

        {/* Back button when zoomed */}
        {selectedRegionCode && (
          <button
            type="button"
            className="zoom-back-btn"
            onClick={() => setSelectedRegionCode(null)}
          >
            ← Kembali ke peta utama
          </button>
        )}

        <div className="legend" aria-label="Legenda marker cabang">
          <div className="legend-item"><span className="legend-dot regular" /> Cabang reguler</div>
          <div className="legend-item"><span className="legend-dot special" /> Cabang khusus ✦</div>
          <div className="legend-item"><span className="legend-dot highlighted" /> Fokus utama</div>
        </div>

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

        {!selectedRegionCode && (
          <div className="sidebar-hint">Klik provinsi pada peta untuk melihat cabang</div>
        )}

        {branchGroups.map((group) => (
          <section
            className={`sidebar-region${selectedRegionCode === group.regionCode ? " expanded" : ""}`}
            key={group.regionCode}
          >
            <button
              type="button"
              className={`sidebar-region-header${selectedRegionCode === group.regionCode ? " active" : ""}`}
              onClick={() => toggleRegion(group.regionCode)}
            >
              <span>{group.region}</span>
              <span>{group.branches.length}</span>
            </button>

            <div className="sidebar-region-list">
              {group.branches.map((branch) => (
                <button
                  type="button"
                  key={branch.id}
                  className={`sidebar-branch${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                    activeBranchId === branch.id ? " active" : ""
                  }`}
                  onMouseEnter={() => {
                    setActiveBranchId(branch.id);
                    if (selectedRegionCode === branch.regionCode) return;
                    setSelectedRegionCode(branch.regionCode);
                  }}
                  onMouseLeave={() => setActiveBranchId(null)}
                  onFocus={() => setActiveBranchId(branch.id)}
                  onBlur={() => setActiveBranchId(null)}
                  onClick={() => {
                    setSelectedRegionCode(branch.regionCode);
                    setActiveBranchId(branch.id);
                  }}
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
