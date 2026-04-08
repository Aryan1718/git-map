import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";

function Graph() {
  const { owner = "", repo = "" } = useParams();
  const [status, setStatus] = useState("loading");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadGraph() {
      setStatus("loading");
      setError("");

      try {
        const response = await fetch("http://localhost:8000/analyze-repo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ owner, repo }),
          signal: controller.signal,
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || "Failed to analyze repository");
        }

        setMeta(payload.meta || null);
        setStatus("success");
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          return;
        }
        setError(fetchError.message || "Failed to analyze repository");
        setStatus("error");
      }
    }

    if (owner && repo) {
      loadGraph();
    }

    return () => controller.abort();
  }, [owner, repo]);

  const statusText = useMemo(() => {
    if (status === "loading") {
      return "Analyzing repository with RepoMap and Tree-sitter…";
    }
    if (status === "error") {
      return error;
    }
    return "D3 visualization coming next phase";
  }, [error, status]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070910] px-6 py-10 text-slate-50">
      <div className="particle-layer opacity-80" />
      <div className="absolute inset-0 bg-hero-grid bg-[length:70px_70px] opacity-[0.06]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-6xl rounded-[28px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-xl md:p-12"
      >
        <div className="flex flex-col gap-6 border-b border-white/8 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">git-map</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              {owner}/{repo}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">{statusText}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back to home
            </Link>
            <a
              href={`https://git-map.com/${owner}/${repo}`}
              className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-500/10 px-4 py-2 text-sm text-teal-100"
            >
              Direct route
            </a>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="glass-panel rounded-card p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Status</p>
              <p className="mt-3 text-lg font-medium text-white">
                {status === "loading" ? "Processing" : status === "success" ? "Ready" : "Error"}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-panel rounded-card p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Files parsed</p>
                <p className="mt-3 text-lg font-medium text-white">{meta?.file_count ?? "—"}</p>
              </div>
              <div className="glass-panel rounded-card p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Nodes / links</p>
                <p className="mt-3 text-lg font-medium text-white">
                  {meta ? `${meta.node_count} / ${meta.link_count}` : "—"}
                </p>
              </div>
            </div>
            <div className="glass-panel rounded-card p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">How direct links work</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                When this frontend is deployed on `git-map.com`, a route like `https://git-map.com/{owner}/{repo}` opens this page directly and triggers the backend analysis request for the same repository.
              </p>
            </div>
          </div>

          <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/65 to-indigo-950/20 px-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Visualization Surface</p>
              <p className="mt-4 text-xl font-medium text-white md:text-2xl">
                {status === "success"
                  ? `Graph for ${owner}/${repo} ready for D3 rendering`
                  : status === "error"
                    ? "Unable to generate graph"
                    : "Building repo map"}
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400 md:text-base">
                This page is wired to the backend analysis flow now. The full interactive D3 graph replaces this placeholder in the next phase.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Graph;
