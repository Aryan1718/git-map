import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import RepoGraphCanvas from "../components/RepoGraphCanvas";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

function Graph() {
  const { owner = "", repo = "" } = useParams();
  const [status, setStatus] = useState("loading");
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadGraph() {
      setStatus("loading");
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/analyze-repo`, {
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

        setGraph(payload);
        setStatus("success");
      } catch (fetchError) {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Failed to analyze repository");
        setStatus("error");
      }
    }

    if (owner && repo) {
      loadGraph();
    }

    return () => controller.abort();
  }, [owner, repo]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070910] px-4 py-6 text-slate-50 md:px-6 md:py-8">
      <div className="particle-layer opacity-80" />
      <div className="absolute inset-0 bg-hero-grid bg-[length:70px_70px] opacity-[0.05]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-[1500px]"
      >
        <div className="mb-6 flex flex-col gap-4 rounded-[26px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Git-map</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              {owner}/{repo}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              {status === "loading"
                ? "Analyzing repository structure and building graph relationships."
                : status === "error"
                  ? error
                  : "Interactive repository graph generated from the backend knowledge map."}
            </p>
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
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-500/10 px-4 py-2 text-sm text-teal-100 transition hover:border-teal-300/40 hover:bg-teal-500/20"
            >
              Open GitHub repo
            </a>
          </div>
        </div>

        {status === "loading" ? (
          <div className="glass-panel rounded-[24px] border border-white/10 p-10 text-center shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300" />
            <p className="mt-6 text-lg text-white">Building graph for {owner}/{repo}</p>
            <p className="mt-2 text-sm text-slate-400">Fetching files, parsing symbols, and resolving relationships.</p>
          </div>
        ) : status === "error" ? (
          <div className="glass-panel rounded-[24px] border border-rose-400/20 p-10 text-center shadow-[0_24px_90px_rgba(0,0,0,0.32)]">
            <p className="text-lg text-white">Unable to generate the graph.</p>
            <p className="mt-3 text-sm text-rose-200">{error}</p>
          </div>
        ) : (
          <RepoGraphCanvas graph={graph} owner={owner} repo={repo} />
        )}
      </motion.div>
    </div>
  );
}

export default Graph;
