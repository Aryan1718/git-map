import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { track } from "@vercel/analytics";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const ANALYSIS_STAGES = [
  {
    id: "validating",
    label: "Validating repository",
    description: "Checking the repository path and latest commit.",
    targetProgress: 10,
    startsAtMs: 0,
  },
  {
    id: "fetching",
    label: "Fetching repository tree",
    description: "Loading the repo structure and source inventory.",
    targetProgress: 26,
    startsAtMs: 650,
  },
  {
    id: "filtering",
    label: "Filtering supported files",
    description: "Selecting parseable code files for analysis.",
    targetProgress: 40,
    startsAtMs: 1800,
  },
  {
    id: "parsing",
    label: "Parsing symbols",
    description: "Extracting files, classes, functions, and references.",
    targetProgress: 61,
    startsAtMs: 3400,
  },
  {
    id: "building",
    label: "Building knowledge graph",
    description: "Connecting definitions and references into graph edges.",
    targetProgress: 80,
    startsAtMs: 5600,
  },
  {
    id: "preparing",
    label: "Preparing overview",
    description: "Finalizing the payload and repository summary.",
    targetProgress: 90,
    startsAtMs: 7900,
  },
  {
    id: "rendering",
    label: "Rendering graph",
    description: "Mounting the graph view and restoring interactions.",
    targetProgress: 97,
    startsAtMs: 0,
  },
  {
    id: "ready",
    label: "Graph ready",
    description: "The repository map is ready to explore.",
    targetProgress: 100,
    startsAtMs: 0,
  },
];

function getStageIndex(stageId) {
  return Math.max(0, ANALYSIS_STAGES.findIndex((stage) => stage.id === stageId));
}

function stageFromElapsed(elapsedMs) {
  let current = ANALYSIS_STAGES[0];
  for (const stage of ANALYSIS_STAGES.slice(0, 6)) {
    if (elapsedMs >= stage.startsAtMs) {
      current = stage;
    } else {
      break;
    }
  }
  return current;
}

function describeRepository(meta, owner, repo) {
  if (!meta) {
    return `${owner}/${repo}`;
  }

  const fileCount = typeof meta.file_count === "number" ? `${meta.file_count} files` : null;
  const nodeCount = typeof meta.node_count === "number" ? `${meta.node_count} nodes` : null;
  return [fileCount, nodeCount].filter(Boolean).join(" • ") || `${owner}/${repo}`;
}

function Graph() {
  const { owner = "", repo = "" } = useParams();
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [graphMounted, setGraphMounted] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [analysisStage, setAnalysisStage] = useState("validating");
  const [progress, setProgress] = useState(4);
  const [stageNote, setStageNote] = useState(ANALYSIS_STAGES[0].description);
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const progressTimerRef = useRef(null);
  const handoffTimerRef = useRef(null);

  const graphUrl = useMemo(() => {
    if (!owner || !repo) return "";
    return `${API_BASE_URL}/${owner}/${repo}`;
  }, [owner, repo]);

  const graphApiUrl = useMemo(() => {
    if (!owner || !repo) return "";
    return `${API_BASE_URL}/api/graph/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
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

  useEffect(() => {
    if (!owner || !repo || !graphApiUrl || !graphUrl) {
      return undefined;
    }

    const controller = new AbortController();
    const startedAt = Date.now();

    setFrameLoaded(false);
    setGraphMounted(false);
    setOverlayVisible(true);
    setAnalysisStage("validating");
    setStageNote(ANALYSIS_STAGES[0].description);
    setProgress(4);
    setAnalysisMeta(null);
    setError("");

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
    if (handoffTimerRef.current) {
      window.clearTimeout(handoffTimerRef.current);
    }

    // The backend currently returns a single final graph payload, so these stages are
    // lifecycle cues driven by real milestones plus elapsed request time rather than
    // byte-accurate backend progress.
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const stage = stageFromElapsed(elapsed);

      setAnalysisStage((current) => {
        const currentIndex = getStageIndex(current);
        const nextIndex = getStageIndex(stage.id);
        return nextIndex > currentIndex ? stage.id : current;
      });
      setStageNote(stage.description);
      setProgress((current) => {
        const next = current + 0.75;
        return Math.min(Math.max(next, 4), stage.targetProgress);
      });
    }, 180);

    const loadGraph = async () => {
      try {
        const response = await fetch(graphApiUrl, { signal: controller.signal });
        let payload = null;

        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error(payload?.detail || "Repository analysis failed.");
        }

        if (controller.signal.aborted) {
          return;
        }

        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        setAnalysisMeta(payload?.meta || null);
        setAnalysisStage("rendering");
        setStageNote(ANALYSIS_STAGES[getStageIndex("rendering")].description);
        setProgress(94);
        setGraphMounted(true);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        setError(requestError instanceof Error ? requestError.message : "Repository analysis failed.");
        setAnalysisStage("error");
        setStageNote("The repository could not be analyzed.");
        setProgress(100);
        setGraphMounted(false);
      }
    };

    loadGraph();

    return () => {
      controller.abort();
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (handoffTimerRef.current) {
        window.clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, [graphApiUrl, graphUrl, owner, reloadToken, repo]);

  useEffect(() => {
    if (!frameLoaded) {
      return undefined;
    }

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setAnalysisStage("ready");
    setStageNote(ANALYSIS_STAGES[getStageIndex("ready")].description);
    setProgress(100);

    handoffTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, 520);

    return () => {
      if (handoffTimerRef.current) {
        window.clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, [frameLoaded]);

  const currentStageIndex = getStageIndex(analysisStage);
  const loadingStageSteps = ANALYSIS_STAGES.slice(0, 7);

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
          <div className="relative h-[calc(100vh-73px)] w-full bg-[#070910]">
            <AnimatePresence>
              {overlayVisible && (
                <motion.div
                  key={`${owner}-${repo}-${reloadToken}-overlay`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.24, ease: "easeOut" } }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_35%),rgba(7,9,16,0.74)] px-4 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.99 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,17,28,0.92),rgba(5,8,15,0.9))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.48)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Repository analysis</p>
                        <h2 className="mt-3 text-2xl font-semibold text-white">
                          {error ? "Analysis interrupted" : analysisStage === "ready" ? "Graph ready" : "Analyzing repository"}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {error || stageNote}
                        </p>
                      </div>
                      <div className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-teal-100">
                        {Math.round(progress)}%
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="h-2 overflow-hidden rounded-full bg-white/6">
                        <motion.div
                          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.85),rgba(99,102,241,0.92))] shadow-[0_0_24px_rgba(99,102,241,0.35)]"
                          initial={false}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{describeRepository(analysisMeta, owner, repo)}</span>
                        <span>{analysisMeta?.cached ? "Cache hit" : "Live analysis"}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3">
                      {loadingStageSteps.map((stage, index) => {
                        const isComplete = currentStageIndex > index || analysisStage === "ready";
                        const isCurrent = analysisStage === stage.id;
                        const isUpcoming = !isComplete && !isCurrent;

                        return (
                          <div
                            key={stage.id}
                            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                              isCurrent
                                ? "border-indigo-400/35 bg-indigo-500/10"
                                : isComplete
                                  ? "border-teal-400/20 bg-teal-500/[0.06]"
                                  : "border-white/6 bg-white/[0.02]"
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium ${
                                isCurrent
                                  ? "border-indigo-300/60 bg-indigo-400/15 text-indigo-100"
                                  : isComplete
                                    ? "border-teal-300/50 bg-teal-400/15 text-teal-100"
                                    : "border-white/10 bg-white/5 text-slate-500"
                              }`}
                            >
                              {isComplete ? "✓" : index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium ${isUpcoming ? "text-slate-500" : "text-white"}`}>
                                  {stage.label}
                                </p>
                                {isCurrent && !error ? (
                                  <motion.span
                                    className="inline-flex h-2 w-2 rounded-full bg-indigo-300"
                                    animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.35, 1] }}
                                    transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                                  />
                                ) : null}
                              </div>
                              <p className={`mt-1 text-xs leading-5 ${isUpcoming ? "text-slate-600" : "text-slate-400"}`}>
                                {stage.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {error ? (
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setReloadToken((current) => current + 1)}
                          className="inline-flex items-center rounded-full border border-indigo-400/35 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-100 transition hover:border-indigo-300/50 hover:bg-indigo-500/20"
                        >
                          Retry analysis
                        </button>
                        <Link
                          to="/"
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                        >
                          Back home
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-6 text-sm text-slate-500">
                        {analysisStage === "ready"
                          ? "The graph is loaded and interactions are now active."
                          : "The graph workspace stays anchored while analysis runs in the background."}
                      </p>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {graphMounted ? (
              <iframe
                key={`${owner}-${repo}-${reloadToken}`}
                title={`Graph for ${owner}/${repo}`}
                src={graphUrl}
                onLoad={() => setFrameLoaded(true)}
                className={`block h-full w-full border-0 bg-[#070910] transition-opacity duration-300 ${
                  frameLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.84))]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Graph;
