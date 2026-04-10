import { motion } from "framer-motion";
import LayoutTextFlip from "./LayoutTextFlip";

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100vh-88px)] items-center px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative w-full max-w-4xl text-center"
        >
          <div className="mb-8 flex justify-center">
            <a
              href="https://github.com/Aryan1718/git-map"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 0 0 7.86 10.918c.575.107.785-.25.785-.556 0-.274-.01-1-.015-1.962-3.197.694-3.872-1.54-3.872-1.54-.523-1.33-1.277-1.685-1.277-1.685-1.044-.714.079-.7.079-.7 1.154.081 1.761 1.185 1.761 1.185 1.025 1.757 2.69 1.25 3.346.956.104-.743.401-1.25.73-1.538-2.552-.29-5.236-1.276-5.236-5.68 0-1.255.448-2.281 1.183-3.085-.118-.29-.513-1.459.112-3.042 0 0 .965-.309 3.162 1.178A10.96 10.96 0 0 1 12 6.032c.972.004 1.952.131 2.867.385 2.196-1.487 3.16-1.178 3.16-1.178.627 1.583.232 2.752.114 3.042.737.804 1.182 1.83 1.182 3.085 0 4.415-2.688 5.387-5.248 5.672.412.355.78 1.057.78 2.132 0 1.54-.014 2.78-.014 3.16 0 .309.207.669.79.555A11.503 11.503 0 0 0 23.5 12C23.5 5.648 18.352.5 12 .5Z" />
              </svg>
              GitHub Stars
            </a>
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl font-medium leading-[1.05] tracking-[-0.045em] text-slate-100 md:text-5xl">
            Git-map creates interactive knowledge graphs for any repository.
          </h1>

          <div className="mt-12">
            <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
              <LayoutTextFlip
                text="https://"
                words={["github.com", "git-map.com"]}
                suffix="/facebook/react"
              />
              <a
                href="/facebook/react"
                aria-label="Open facebook/react graph"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-100"
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
