import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import parseGithubUrl from "../utils/parseGithubUrl";

const examples = [
  {
    label: "fastapi/fastapi",
    description: "API framework with rich routing and dependency injection internals.",
  },
  {
    label: "tiangolo/sqlmodel",
    description: "Typed models and SQLAlchemy integration with declarative patterns.",
  },
  {
    label: "encode/httpx",
    description: "HTTP client architecture with transports, auth flows, and async support.",
  },
];

function ExampleRepos() {
  const navigate = useNavigate();

  const handleExampleClick = (label) => {
    const parsed = parseGithubUrl(label);
    if (!parsed) {
      return;
    }
    navigate(`/${parsed.owner}/${parsed.repo}`);
  };

  return (
    <section className="section-anchor px-6 py-12 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-teal-300/80">Example repos</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">Start with a repo that already has interesting structure.</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {examples.map((example, index) => (
            <motion.button
              key={example.label}
              type="button"
              onClick={() => handleExampleClick(example.label)}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              whileHover={{ y: -6 }}
              className="glass-panel rounded-card group p-6 text-left transition hover:border-indigo-400/25 hover:bg-indigo-500/[0.06]"
            >
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Example {index + 1}</p>
              <h3 className="mt-4 text-xl font-semibold text-white group-hover:text-indigo-100">{example.label}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{example.description}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm text-indigo-200">
                Open direct route
                <span aria-hidden="true">→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExampleRepos;
