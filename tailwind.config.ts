import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/*
 * Theme tokens: light, blue-accent system.
 *
 * The legacy names (brass, ink, cream, surface, line) are kept because they are
 * used across ~60 files. They now point at the new palette, by the role each one
 * plays in the markup:
 *   brass  -> primary accent (buttons, links, active states)
 *   ink    -> text on the accent, and page-coloured overlays (white)
 *   cream  -> main text (was light-on-dark text)
 *   line   -> borders and dividers
 * New code should prefer the semantic names: primary, canvas, success, danger.
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

        // Legacy names, remapped
        brass: "#2563EB",
        "brass-soft": "#EFF6FF",
        ink: "#FFFFFF",
        cream: "#0F172A",
        surface: "#FFFFFF",
        "surface-raised": "#F1F5F9",
        line: "#E2E8F0",

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
