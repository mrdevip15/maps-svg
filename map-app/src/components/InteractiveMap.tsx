import { useEffect, useRef, useState, useCallback } from "react";
import { populationData } from "../data/population";
import { pathToProvince } from "../data/provinceMap";

interface TooltipData {
  name: string;
  population: number;
  x: number;
  y: number;
}

export default function InteractiveMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Fetch SVG
  useEffect(() => {
    fetch("/all_region.svg")
      .then((r) => r.text())
      .then((text) => setSvgContent(text));
  }, []);

  // Attach event listeners after SVG content is set
  useEffect(() => {
    if (!svgContent || !svgRef.current) return;

    const paths = svgRef.current.querySelectorAll("path");
    paths.forEach((path, i) => {
      path.dataset.pathIndex = String(i);
      path.style.cursor = "pointer";
      path.style.transition = "opacity 0.2s, filter 0.2s";

      path.addEventListener("mouseenter", onEnter);
      path.addEventListener("mouseleave", onLeave);
    });

    return () => {
      paths.forEach((path) => {
        path.removeEventListener("mouseenter", onEnter);
        path.removeEventListener("mouseleave", onLeave);
      });
    };

    function onEnter(e: Event) {
      const target = e.target as SVGPathElement;
      const idx = Number(target.dataset.pathIndex);
      const code = pathToProvince[idx];
      const data = code ? populationData[code] : undefined;
      if (data) {
        const me = e as MouseEvent;
        setTooltip({
          name: data.name,
          population: data.population,
          x: me.clientX + 14,
          y: me.clientY - 10,
        });
        setHoveredIdx(idx);
      }
    }

    function onLeave() {
      setTooltip(null);
      setHoveredIdx(null);
    }
  }, [svgContent]);

  // Apply hover highlight
  useEffect(() => {
    if (!svgRef.current) return;
    const paths = svgRef.current.querySelectorAll("path");
    paths.forEach((path, i) => {
      if (i === hoveredIdx) {
        path.style.opacity = "0.8";
        path.style.filter = "brightness(1.35)";
      } else if (hoveredIdx !== null) {
        path.style.opacity = "0.4";
        path.style.filter = "none";
      } else {
        path.style.opacity = "1";
        path.style.filter = "none";
      }
    });
  }, [hoveredIdx]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 10 } : null
    );
  }, []);

  // Strip outer <svg> tag and keep only path elements
  const pathsOnly = svgContent.replace(/<\/*svg[^>]*>/g, "").trim();

  return (
    <div className="map-container" onMouseMove={handleMouseMove}>
      <svg
        ref={svgRef}
        viewBox="334.8 60 407.6 150"
        preserveAspectRatio="xMinYMin"
        className="map-svg"
        dangerouslySetInnerHTML={{ __html: pathsOnly }}
      />

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
