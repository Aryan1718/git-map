import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";

function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  return origin.replace(/\/$/, "");
}

function Graph() {
  const { owner = "", repo = "" } = useParams();
  const [frameLoaded, setFrameLoaded] = useState(false);

  const graphUrl = useMemo(() => {
    if (!owner || !repo) return "";
    return `${getApiBaseUrl()}/${owner}/${repo}`;
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
            className="block h-screen w-full border-0 bg-[#070910]"
          />
        </div>
      </motion.div>
    </div>
  );
}

export default Graph;
