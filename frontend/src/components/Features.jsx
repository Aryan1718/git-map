import { motion } from "framer-motion";

const features = [
  {
    title: "AST-powered",
    description: "Tree-sitter parses every supported file with structural accuracy instead of raw text guessing.",
  },
  {
    title: "Instant graph",
    description: "The backend returns a force-directed graph payload in seconds, ready for D3 rendering.",
  },
  {
    title: "Symbol links",
    description: "Trace which files, classes, and functions reference each other across the repository.",
  },
  {
    title: "PageRank scoring",
    description: "Surface the most referenced symbols first so important architecture rises to the top.",
  },
];

function Features() {
  return (
    <section id="features" className="section-anchor px-6 py-12 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.35em] text-indigo-300/80">Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">Built for understanding code structure, not just reading files.</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-400">
            git-map combines structural parsing, graph generation, and a clean interaction model so large repos feel navigable.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.07 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className="glass-panel rounded-card p-6 transition will-change-transform"
            >
              <div className="flex items-center gap-4">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-indigo-400 to-teal-400 shadow-[0_0_24px_rgba(99,102,241,0.55)]" />
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
