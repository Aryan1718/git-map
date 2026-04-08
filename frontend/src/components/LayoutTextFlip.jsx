import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

function LayoutTextFlip({ text, words, suffix = "", intervalMs = 2200 }) {
  const [index, setIndex] = useState(0);
  const activeWord = words[index] || "";
  const isShorterWord = activeWord.length < Math.max(...words.map((word) => word.length));

  useEffect(() => {
    if (!words.length) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, words]);

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-0 gap-y-2 text-center font-mono text-lg font-medium tracking-[-0.03em] md:flex-nowrap md:text-2xl">
      {text ? <span className="shrink-0 leading-none text-slate-400">{text}</span> : null}
      <span className="relative inline-flex min-w-[10ch] justify-start px-0 py-0 text-left text-white md:min-w-[11ch]">
        <AnimatePresence mode="wait">
          <motion.span
            key={words[index]}
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="block leading-none text-white"
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
      {suffix ? (
        <motion.span
          className="shrink-0 leading-none text-slate-400"
          animate={{ x: isShorterWord ? -10 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {suffix}
        </motion.span>
      ) : null}
    </div>
  );
}

export default LayoutTextFlip;
