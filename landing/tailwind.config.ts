import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#0B0B0F",
        basalt: "#16161D",
        bone: "#F5F1E8",
        ash: "#8A8A94",
        oxblood: "#8B1E1E",
        patina: "#C9A961",
        verdant: "#3F7D58",
        smoke: "#4A4A52",
        ember: "#D4742C",
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        geist: ["var(--font-geist)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
