import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — mapped to CSS vars (resolves for both themes)
        surface: "var(--bg-body)",
        panel:   "var(--bg-panel)",
        panel2:  "var(--bg-panel-2)",
        panel3:  "var(--bg-panel-3)",
        border:  "var(--border)",
        ink:     "var(--text-strong)",
        muted:   "var(--text-muted)",

        // Brand / accent
        brand: {
          DEFAULT: "#4f46e5",
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#4f46e5",  // primary action
          600: "#4338ca",
          700: "#3730a3",
        },
        accent: {
          DEFAULT: "#10b981",
          50:  "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        danger: {
          50:  "#fef2f2",
          100: "#fee2e2",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        warn: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
        },

        // Explicit dark-palette helpers (use when dark: prefix needed)
        dark: {
          body:  "#1d2125",
          panel: "#22272b",
          p2:    "#2c333a",
          p3:    "#38434f",
          bdr:   "#444c56",
          text:  "#b6c2cf",
          hi:    "#dfe1e6",
          muted: "#8c9bab",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"Fira Code"', '"JetBrains Mono"', "Menlo", "monospace"],
      },
      borderRadius: {
        sm:  "4px",
        md:  "6px",
        lg:  "8px",
        xl:  "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        panel: "0 1px 3px rgba(9,30,66,0.12), 0 0 0 1px rgba(9,30,66,0.04)",
        float: "0 8px 16px rgba(9,30,66,0.15)",
        soft:  "0 4px 12px rgba(9,30,66,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
