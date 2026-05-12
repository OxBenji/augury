import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        panel: "#1A1A1A",
        border: "#3A3A3A",
        text: "#FFFFFF",
        muted: "#888888",
        accent: "#FF3B00",
        // deprecated aliases
        obsidian: "#000000",
        basalt: "#1A1A1A",
        bone: "#FFFFFF",
        oxblood: "#FF3B00",
        patina: "#FF3B00",
        ash: "#888888",
        smoke: "#3A3A3A",
      },
      fontFamily: {
        geist: ["var(--font-geist)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
