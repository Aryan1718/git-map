import { useMemo, useState } from "react";
import { motion } from "framer-motion";

function buildCells(rows, cols) {
  return Array.from({ length: rows * cols }, (_, index) => ({
    row: Math.floor(index / cols),
    col: index % cols,
  }));
}

function BackgroundRippleEffect({ rows = 8, cols = 18, cellSize = 64 }) {
  const [clickedCell, setClickedCell] = useState(null);
  const cells = useMemo(() => buildCells(rows, cols), [rows, cols]);

  const triggerRipple = (row, col) => {
    setClickedCell({ row, col, key: `${row}-${col}-${Date.now()}` });
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(${cellSize}px, 1fr))`,
        }}
      >
        {cells.map((cell) => {
          const distance = clickedCell
            ? Math.abs(clickedCell.row - cell.row) + Math.abs(clickedCell.col - cell.col)
            : null;

          return (
            <motion.button
              key={`${cell.row}-${cell.col}`}
              type="button"
              onMouseEnter={() => triggerRipple(cell.row, cell.col)}
              onClick={() => triggerRipple(cell.row, cell.col)}
              className="group relative border border-white/10 bg-white/[0.03] outline-none transition-colors hover:bg-white/[0.06]"
            >
              <motion.span
                key={clickedCell?.key ?? "idle"}
                className="absolute inset-0 bg-white/[0.08]"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: clickedCell ? [0, 0.95, 0] : 0,
                }}
                transition={{
                  duration: 0.55,
                  delay: distance !== null ? distance * 0.03 : 0,
                  ease: "easeOut",
                }}
              />
            </motion.button>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,20,0.32),rgba(13,15,20,0.72))]" />
    </div>
  );
}

export default BackgroundRippleEffect;
