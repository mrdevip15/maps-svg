import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { eacBranches, type EacBranch } from "../data/eacBranches";
import { pathToProvince } from "../data/provinceMap";

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
  const [hoveredRegionCode, setHoveredRegionCode] = useState<string | null>(null);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [svgRaw, setSvgRaw] = useState<string | null>(null);

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

  const activeRegionCode = hoveredRegionCode ?? selectedRegionCode;

  const moveTooltip = useCallback((e: MouseEvent) => {
    setTooltip((prev) => (prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 10 } : null));
  }, []);

  const handleProvinceEnter = useCallback(
    (idx: number, e: MouseEvent) => {
      const regionCode = pathToProvince[idx];
      const regionBranches = regionCode ? branchesByRegion[regionCode] : undefined;

      if (regionCode && regionBranches?.length) {
        setHoveredIdx(idx);
        setHoveredRegionCode(regionCode);
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
    setHoveredRegionCode(null);
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

  const toggleRegion = useCallback((regionCode: string) => {
    setSelectedRegionCode((current) => (current === regionCode ? null : regionCode));
  }, []);

  return (
    <div className="map-layout">
      <div className="map-container" onMouseMove={tooltip ? moveTooltip : undefined}>
        <svg viewBox="500 10 470 320" preserveAspectRatio="xMinYMin" className="map-svg">
          {paths.map(({ d, fill, index }) => {
            const regionCode = pathToProvince[index];
            const isTarget = targetIndices.has(index);
            const isHovered = index === hoveredIdx || (!!activeRegionCode && regionCode === activeRegionCode);
            const isDimmed = activeRegionCode !== null && regionCode !== activeRegionCode;

            return (
              <path
                key={index}
                d={d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={1.5}
                className={isHovered ? "province-active" : undefined}
                style={{
                  cursor: isTarget ? "pointer" : "default",
                  opacity: activeRegionCode !== null ? (isHovered ? 1 : isTarget ? 0.32 : 0.12) : isTarget ? 1 : 0.2,
                  filter: isDimmed ? "grayscale(0.25)" : undefined,
                }}
                onMouseEnter={isTarget ? (e) => handleProvinceEnter(index, e) : undefined}
                onMouseLeave={isTarget ? handleProvinceLeave : undefined}
              />
            );
          })}

          {eacBranches.map((branch) => {
            const isBranchActive = branch.id === activeBranchId;
            const isRegionActive = activeRegionCode === branch.regionCode;
            const shouldDim = activeRegionCode !== null && !isRegionActive;

            return (
              <g
                key={branch.id}
                className={`branch-marker${branch.special ? " special" : ""}${branch.highlighted ? " highlighted" : ""}${
                  isBranchActive || isRegionActive ? " active" : ""
                }${shouldDim ? " dimmed" : ""}`}
                onMouseEnter={(e) => handleMarkerEnter(branch, e)}
                onMouseLeave={handleMarkerLeave}
                onClick={() => {
                  setActiveBranchId(branch.id);
                  setSelectedRegionCode(branch.regionCode);
                }}
              >
                {branch.highlighted && <circle className="marker-pulse" cx={branch.x} cy={branch.y} r="8" />}
                <circle
                  cx={branch.x}
                  cy={branch.y}
                  r={branch.highlighted ? 6 : 4}
                  className="marker-dot"
                />
                {branch.special && !branch.highlighted && (
                  <path
                    className="marker-star"
                    d={`M ${branch.x} ${branch.y - 8} L ${branch.x + 4} ${branch.y - 4} L ${branch.x} ${branch.y} L ${branch.x - 4} ${branch.y - 4} Z`}
                  />
                )}
              </g>
            );
          })}
        </svg>

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

        {branchGroups.map((group) => (
          <section className="sidebar-region" key={group.regionCode}>
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
                  onMouseEnter={() => setActiveBranchId(branch.id)}
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
