import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const TYPE_COLORS = {
  file: { fill: "#0f3c48", stroke: "#2dd4bf", text: "#ccfbf1" },
  route: { fill: "#123042", stroke: "#38bdf8", text: "#dbeafe" },
  callable: { fill: "#332113", stroke: "#fb923c", text: "#fed7aa" },
  type: { fill: "#2a2145", stroke: "#a78bfa", text: "#ede9fe" },
  module: { fill: "#233140", stroke: "#60a5fa", text: "#dbeafe" },
  def: { fill: "#332113", stroke: "#fb923c", text: "#fed7aa" },
  class: { fill: "#2a2145", stroke: "#a78bfa", text: "#ede9fe" },
};

function colorForNode(node) {
  return TYPE_COLORS[node.type] || TYPE_COLORS[node.normalized_kind] || TYPE_COLORS.file;
}

function radiusForNode(node) {
  if (node.type === "file") return 13;
  if (node.type === "route") return 12;
  return 7 + Math.max(0, Math.min(node.weight || 0, 1)) * 6;
}

function normalizeTerm(value) {
  return (value || "").trim().toLowerCase();
}

function nodeMatches(node, query) {
  if (!query) return true;
  const haystack = [node.label, node.id, node.file, node.qualified_name, node.normalized_kind]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function buildConnectedSet(nodes, links, selectedId, searchQuery) {
  const selected = new Set();
  const query = normalizeTerm(searchQuery);
  const matchedIds = new Set(nodes.filter((node) => nodeMatches(node, query)).map((node) => node.id));

  if (!selectedId && !matchedIds.size) {
    return { selected, matchedIds };
  }

  const adjacency = new Map();
  for (const link of links) {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    if (!adjacency.has(sourceId)) adjacency.set(sourceId, new Set());
    if (!adjacency.has(targetId)) adjacency.set(targetId, new Set());
    adjacency.get(sourceId).add(targetId);
    adjacency.get(targetId).add(sourceId);
  }

  const queue = [];
  if (selectedId) queue.push(selectedId);
  for (const id of matchedIds) queue.push(id);

  while (queue.length) {
    const current = queue.shift();
    if (!current || selected.has(current)) continue;
    selected.add(current);
    for (const neighbor of adjacency.get(current) || []) {
      if (!selected.has(neighbor)) queue.push(neighbor);
    }
  }

  return { selected, matchedIds };
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-3 text-sm last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[70%] text-right text-slate-100">{value || "—"}</span>
    </div>
  );
}

function RepoGraphCanvas({ graph, owner, repo }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 640 });
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const nodes = graph?.nodes || [];
  const links = graph?.links || [];

  const { selected, matchedIds } = useMemo(
    () => buildConnectedSet(nodes, links, selectedId, search),
    [links, nodes, search, selectedId],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) || null,
    [nodes, selectedId],
  );

  const stats = useMemo(() => {
    const files = nodes.filter((node) => node.type === "file").length;
    const symbols = nodes.length - files;
    return { files, symbols };
  }, [nodes]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(320, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(460, Math.floor(entry.contentRect.height));
      setDimensions({ width: nextWidth, height: nextHeight });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return undefined;

    const width = dimensions.width;
    const height = dimensions.height;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const root = svg.append("g");
    const linkLayer = root.append("g");
    const nodeLayer = root.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.35, 2.5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulationNodes = nodes.map((node) => ({ ...node }));
    const simulationLinks = links.map((link) => ({
      ...link,
      source: typeof link.source === "object" ? link.source.id : link.source,
      target: typeof link.target === "object" ? link.target.id : link.target,
    }));

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id((d) => d.id).distance((link) => {
        if (link.type === "contains") return 56;
        return 120;
      }))
      .force("charge", d3.forceManyBody().strength((node) => (node.type === "file" ? -380 : -180)))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((node) => radiusForNode(node) + 10))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03));

    const link = linkLayer
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke", (item) => (item.type === "contains" ? "rgba(148,163,184,0.22)" : "rgba(99,102,241,0.38)"))
      .attr("stroke-width", (item) => (item.type === "contains" ? 1 : 1.6));

    const node = nodeLayer
      .selectAll("g")
      .data(simulationNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_, datum) => {
        setSelectedId((current) => (current === datum.id ? "" : datum.id));
      })
      .call(
        d3
          .drag()
          .on("start", (event, datum) => {
            if (!event.active) simulation.alphaTarget(0.24).restart();
            datum.fx = datum.x;
            datum.fy = datum.y;
          })
          .on("drag", (event, datum) => {
            datum.fx = event.x;
            datum.fy = event.y;
          })
          .on("end", (event, datum) => {
            if (!event.active) simulation.alphaTarget(0);
            datum.fx = null;
            datum.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (datum) => radiusForNode(datum))
      .attr("fill", (datum) => colorForNode(datum).fill)
      .attr("stroke", (datum) => colorForNode(datum).stroke)
      .attr("stroke-width", 1.5);

    node
      .append("text")
      .text((datum) => datum.label)
      .attr("x", (datum) => radiusForNode(datum) + 8)
      .attr("y", 4)
      .attr("fill", (datum) => colorForNode(datum).text)
      .style("font-size", (datum) => (datum.type === "file" ? "12px" : "11px"))
      .style("font-weight", (datum) => (datum.type === "file" ? 600 : 500))
      .style("pointer-events", "none")
      .style("paint-order", "stroke")
      .style("stroke", "rgba(7,9,16,0.85)")
      .style("stroke-width", "3px");

    node.append("title").text((datum) => datum.id);

    simulation.on("tick", () => {
      link
        .attr("x1", (datum) => datum.source.x)
        .attr("y1", (datum) => datum.source.y)
        .attr("x2", (datum) => datum.target.x)
        .attr("y2", (datum) => datum.target.y)
        .attr("opacity", (datum) => {
          const sourceId = typeof datum.source === "object" ? datum.source.id : datum.source;
          const targetId = typeof datum.target === "object" ? datum.target.id : datum.target;
          if (!selected.size && !matchedIds.size) return 0.9;
          return selected.has(sourceId) && selected.has(targetId) ? 0.95 : 0.12;
        });

      node
        .attr("transform", (datum) => `translate(${datum.x},${datum.y})`)
        .attr("opacity", (datum) => {
          if (!selected.size && !matchedIds.size) return 1;
          if (matchedIds.has(datum.id)) return 1;
          return selected.has(datum.id) ? 1 : 0.18;
        });
    });

    svg.on("dblclick.zoom", null);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width * 0.08, height * 0.02).scale(0.92));

    return () => simulation.stop();
  }, [dimensions.height, dimensions.width, links, matchedIds, nodes, selected, selectedId]);

  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="glass-panel rounded-[24px] border border-white/10 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex flex-col gap-4 border-b border-white/8 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Repository map</p>
            <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">
              {owner}/{repo}
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {stats.files} files
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {stats.symbols} symbols
            </div>
            <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-100">
              {links.length} links
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full max-w-xl items-center gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300 focus-within:border-indigo-400/40 md:text-base">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-500" fill="none" aria-hidden="true">
              <path d="M14.5 14.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="8.5" cy="8.5" r="5.7" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files, functions, classes"
              className="w-full border-0 bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>
          <p className="text-sm text-slate-400">Drag nodes, click to focus, scroll to zoom.</p>
        </div>

        <div
          ref={containerRef}
          className="relative min-h-[620px] overflow-hidden rounded-[20px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.84))]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40" />
          <svg ref={svgRef} className="relative z-10 h-full w-full" role="img" aria-label={`Knowledge graph for ${owner}/${repo}`} />
        </div>
      </div>

      <aside className="glass-panel rounded-[24px] border border-white/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Selection</p>
        <h3 className="mt-3 text-xl font-semibold text-white">{selectedNode?.label || "Nothing selected"}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          {selectedNode
            ? "This panel reflects the node you clicked in the graph."
            : "Click a node to inspect its type, source file, symbol metadata, and internal identifier."}
        </p>

        <div className="mt-6 rounded-[18px] border border-white/8 bg-slate-950/50 px-4">
          <DetailRow label="Type" value={selectedNode?.type} />
          <DetailRow label="File" value={selectedNode?.file || selectedNode?.id} />
          <DetailRow label="Line" value={selectedNode?.line ? String(selectedNode.line) : ""} />
          <DetailRow label="Weight" value={selectedNode ? String(selectedNode.weight ?? "—") : ""} />
          <DetailRow label="Qualified name" value={selectedNode?.qualified_name} />
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Legend</p>
          {[
            ["file", "Files and modules"],
            ["type", "Classes and types"],
            ["callable", "Functions and methods"],
          ].map(([key, label]) => {
            const colors = colorForNode({ type: key });
            return (
              <div key={key} className="flex items-center gap-3 text-sm text-slate-300">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border"
                  style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
                />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default RepoGraphCanvas;
