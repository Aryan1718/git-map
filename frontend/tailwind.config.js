/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0d0f14",
        panel: "rgba(17, 24, 39, 0.62)",
        indigo: "#6366f1",
        teal: "#14b8a6",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 80px rgba(99,102,241,0.16)",
      },
      borderRadius: {
        card: "12px",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      animation: {
        float: "float 16s ease-in-out infinite",
        drift: "drift 18s linear infinite",
        pulseGlow: "pulseGlow 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -14px, 0)" },
        },
        drift: {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(18px, -18px, 0)" },
          "100%": { transform: "translate3d(0, 0, 0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.42" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
