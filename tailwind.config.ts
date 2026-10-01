import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/*
 * Theme tokens: light, blue-accent system (blue-600 primary, slate neutrals).
 *
 * The legacy names (brass, ink, cream, surface, line) were removed in the Phase 10c
 * sweep once no markup used them. Use Tailwind's blue and slate scales, or the
 * semantic names below: primary, canvas, success, danger.
 */
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

        // New semantic tokens
        primary: {
          DEFAULT: "#2563EB", // blue-600
          hover: "#1D4ED8", // blue-700
          soft: "#EFF6FF", // blue-50
          muted: "#DBEAFE", // blue-100
        },
        canvas: "#F8FAFC", // slate-50, app background
        success: { DEFAULT: "#059669", soft: "#ECFDF5" },
        danger: { DEFAULT: "#DC2626", soft: "#FEF2F2" },

        // Gray follows slate so neutrals match the rest of the palette
        gray: colors.slate,
      },
      borderColor: {
        DEFAULT: "#E2E8F0",
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
