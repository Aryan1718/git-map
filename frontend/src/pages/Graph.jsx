import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";
import { initParticleground } from "../lib/particleground";

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
  const loaderRef = useRef(null);

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

  useEffect(() => {
    if (frameLoaded || !loaderRef.current) {
      return undefined;
    }

    const foreground = loaderRef.current.querySelector("#particles-foreground");
    const background = loaderRef.current.querySelector("#particles-background");

    const foregroundScene = initParticleground(foreground, {
      dotColor: "rgba(255, 255, 255, 1)",
      lineColor: "rgba(255, 255, 255, 0.05)",
      minSpeedX: 0.3,
      maxSpeedX: 0.6,
      minSpeedY: 0.3,
      maxSpeedY: 0.6,
      density: 50000,
      curvedLines: false,
      proximity: 250,
      parallaxMultiplier: 10,
      particleRadius: 4,
    });

    const backgroundScene = initParticleground(background, {
      dotColor: "rgba(255, 255, 255, 0.5)",
      lineColor: "rgba(255, 255, 255, 0.05)",
      minSpeedX: 0.075,
      maxSpeedX: 0.15,
      minSpeedY: 0.075,
      maxSpeedY: 0.15,
      density: 30000,
      curvedLines: false,
      proximity: 20,
      parallaxMultiplier: 20,
      particleRadius: 2,
    });

    return () => {
      foregroundScene.destroy();
      backgroundScene.destroy();
    };
  }, [frameLoaded]);

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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070910]">
              <div ref={loaderRef} className="repo-loader-shell" aria-hidden="true">
                <div id="particles-background" className="vertical-centered-box" />
                <div id="particles-foreground" className="vertical-centered-box" />
                <div className="vertical-centered-box">
                  <div className="content">
                    <div className="loader-circle" />
                    <div className="loader-line-mask">
                      <div className="loader-line" />
                    </div>
                    <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 0.5C5.64873 0.5 0.5 5.64873 0.5 12C0.5 17.0817 3.79113 21.3947 8.35645 22.916C8.93145 23.0201 9.1416 22.6717 9.1416 22.3731C9.1416 22.1035 9.13147 21.3904 9.12646 20.4434C5.92867 21.1389 5.25299 18.9025 5.25299 18.9025C4.72971 17.5731 3.97559 17.2197 3.97559 17.2197C2.93145 16.5054 4.05412 16.52 4.05412 16.52C5.2088 16.6013 5.81622 17.7058 5.81622 17.7058C6.84259 19.4641 8.51098 18.9561 9.16687 18.6614C9.27097 17.9185 9.56851 17.4111 9.89783 17.1204C7.34446 16.8295 4.66095 15.8435 4.66095 11.4375C4.66095 10.1831 5.10905 9.15604 5.84259 8.35223C5.72354 8.06135 5.3291 6.89131 5.95465 5.3078C5.95465 5.3078 6.9209 4.99879 9.12646 6.49475C10.0427 6.24063 11.024 6.11359 12 6.10852C12.9761 6.11359 13.9573 6.24063 14.8753 6.49475C17.0788 4.99879 18.0431 5.3078 18.0431 5.3078C18.6706 6.89131 18.2761 8.06135 18.1571 8.35223C18.8926 9.15604 19.3387 10.1831 19.3387 11.4375C19.3387 15.8541 16.6501 16.8254 14.0891 17.1103C14.5025 17.4662 14.8701 18.1663 14.8701 19.2397C14.8701 20.7787 14.856 22.0195 14.856 22.3731C14.856 22.6742 15.0642 23.0253 15.6471 22.9141C20.2104 21.3905 23.5 17.0799 23.5 12C23.5 5.64873 18.3513 0.5 12 0.5Z"
                        fill="#FFFFFF"
                      />
                    </svg>
                  </div>
                </div>
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
