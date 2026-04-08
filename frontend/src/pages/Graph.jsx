import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

function Graph() {
  const { owner = "", repo = "" } = useParams();
  const [frameLoaded, setFrameLoaded] = useState(false);

  const graphUrl = useMemo(() => {
    if (!owner || !repo) return "";
    return `${API_BASE_URL}/${owner}/${repo}`;
  }, [owner, repo]);

  useEffect(() => {
    if (!owner || !repo) return;

    track("Repo Graph View", {
      route_group: "repo_graph",
      owner,
      repo,
      path_template: "/:owner/:repo",
    });
  }, [owner, repo]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070910] text-slate-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative z-10 flex min-h-screen flex-col"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/8 bg-slate-950/70 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Git-map</p>
            <h1 className="mt-1 truncate text-base font-medium text-white md:text-lg">
              {owner}/{repo}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
            >
              <span aria-hidden="true">←</span>
              Back
            </Link>
            <a
              href={graphUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-500/10 px-4 py-2 text-sm text-teal-100 transition hover:border-teal-300/40 hover:bg-teal-500/20"
            >
              Open backend graph
            </a>
          </div>
        </div>

        <div className="relative flex-1">
          {!frameLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070910]">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300" />
                <p className="mt-6 text-lg text-white">Loading exact backend graph</p>
                <p className="mt-2 text-sm text-slate-400">
                  Rendering the same D3 visualization served by the FastAPI backend.
                </p>
              </div>
            </div>
          )}

          <iframe
            title={`Graph for ${owner}/${repo}`}
            src={graphUrl}
            onLoad={() => setFrameLoaded(true)}
            className="block h-[calc(100vh-73px)] w-full border-0 bg-[#070910]"
          />
        </div>
      </motion.div>
    </div>
  );
}

export default Graph;
