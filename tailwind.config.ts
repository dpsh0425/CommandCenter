import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: "#12151c",
        surface: "#1a1f29",
        "surface-raised": "#212836",
        line: "#313a4a",
        cream: "#e9e7de",
        brass: "#c98a3e",
        "brass-soft": "#3a2f1e",
        gray: {
          50: "#242b38",
          100: "#2b3342",
          400: "#9aa2b1",
          500: "#8b93a3",
          600: "#6f7686",
        },
        red: { 50: "#2c1c1b", 600: "#d97e78" },
        yellow: { 50: "#2c2117", 300: "#d99456" },
        teal: { 600: "#5cae97", 700: "#5cae97" },
        violet: { 600: "#9f93e0", 700: "#9f93e0" },
        amber: { 700: "#d99456" },
      },
      borderColor: {
        DEFAULT: "#313a4a",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
