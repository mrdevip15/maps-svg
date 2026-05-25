import { useState, useMemo, useCallback } from "react";
import { populationData } from "../data/population";
import { pathToProvince } from "../data/provinceMap";

interface TooltipData {
  name: string;
  population: number;
  x: number;
  y: number;
}

// Pre-computed: which SVG path indices are target provinces
const targetIndices = new Set(Object.keys(pathToProvince).map(Number));

function parseSvgPaths(svgText: string): Array<{ d: string; fill: string; index: number }> {
  const regex = /<path[^>]*>/g;
  const results: Array<{ d: string; fill: string; index: number }> = [];
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

export default function InteractiveMap() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [svgRaw, setSvgRaw] = useState<string | null>(null);

  // Fetch SVG once
  if (typeof window !== "undefined" && !svgRaw) {
    fetch("/all_region.svg")
      .then((r) => r.text())
      .then(setSvgRaw)
      .catch(console.error);
  }

  const paths = useMemo(() => (svgRaw ? parseSvgPaths(svgRaw) : []), [svgRaw]);

  const handleMouseEnter = useCallback((idx: number, e: React.MouseEvent) => {
    const code = pathToProvince[idx];
    const data = code ? populationData[code] : undefined;
    if (data) {
      setTooltip({
        name: data.name,
        population: data.population,
        x: e.clientX + 14,
        y: e.clientY - 10,
      });
      setHoveredIdx(idx);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setTooltip((prev) =>
        prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 10 } : null
      );
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIdx(null);
  }, []);

  return (
    <div className="map-container" onMouseMove={hoveredIdx !== null ? handleMouseMove : undefined}>
      <svg
        viewBox="500 10 470 320"
        preserveAspectRatio="xMinYMin"
        className="map-svg"
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
              strokeWidth={1.5}
              style={{
                cursor: isTarget ? "pointer" : "default",
                opacity: hoveredIdx !== null ? (isHovered ? 1 : isTarget ? 0.45 : 0.15) : (isTarget ? 1 : 0.2),
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={isTarget ? (e) => handleMouseEnter(index, e) : undefined}
              onMouseLeave={isTarget ? handleMouseLeave : undefined}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div className="tooltip">
          <div className="tooltip-name">{tooltip.name}</div>
          <div className="tooltip-pop">
            Populasi: {tooltip.population.toLocaleString("id-ID")}
          </div>
        </div>
      )}
    </div>
  );
}
