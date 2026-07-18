import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Charcoal tinted toward the acceptance green, so panels and map
        // read as one surface.
        ink: "#0c0f10",
        "ink-bright": "#e8ede9",
        "ink-dim": "#cfd8d0",
        muted: "#98a29b",
        panel: "rgba(18, 22, 21, 0.92)",
        hairline: "rgba(226, 236, 228, 0.09)",
        oppose: "#db6055",
        support: "#38ad6b",
      },
      fontFamily: {
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
