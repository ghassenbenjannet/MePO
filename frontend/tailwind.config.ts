import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic — resolve from CSS vars
        surface: "var(--bg-body)",
        panel:   "var(--bg-panel)",
        panel2:  "var(--bg-panel-2)",
        panel3:  "var(--bg-panel-3)",
        border:  "var(--border)",
        ink:     "var(--text-strong)",
        muted:   "var(--text-muted)",
        line:    "var(--border)",    // alias — used throughout codebase

        // Brand: violet — identité premium distinctive
        brand: {
          DEFAULT: "#7c3aed",
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
        },

        // Accent: emerald
        accent: {
          DEFAULT: "#10b981",
          50:  "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },

        // Semantic states
        danger: {
          50:  "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        warn: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },

        // Dark-mode helpers
        dark: {
          body:  "#0f111a",
          panel: "#161924",
          p2:    "#1c2030",
          p3:    "#242840",
          bdr:   "#2d3250",
          text:  "#94a3b8",
          hi:    "#e2e8f0",
          muted: "#64748b",
        },
      },

      fontFamily: {
        sans: [
          '"Inter"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', "Menlo", "monospace"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "1.5" }],
        xs:    ["12px", { lineHeight: "1.5" }],
        sm:    ["13px", { lineHeight: "1.6" }],
        base:  ["14px", { lineHeight: "1.6" }],
        md:    ["15px", { lineHeight: "1.55" }],
        lg:    ["16px", { lineHeight: "1.5" }],
        xl:    ["18px", { lineHeight: "1.45" }],
        "2xl": ["20px", { lineHeight: "1.4" }],
        "3xl": ["24px", { lineHeight: "1.35" }],
      },

      borderRadius: {
        sm:    "6px",
        md:    "8px",
        lg:    "10px",
        xl:    "12px",
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },

      boxShadow: {
        sm:    "0 1px 2px rgba(109,40,217,0.06)",
        panel: "0 1px 3px rgba(109,40,217,0.07), 0 0 0 1px rgba(124,58,237,0.05)",
        float: "0 8px 24px rgba(109,40,217,0.13), 0 2px 6px rgba(109,40,217,0.07)",
        soft:  "0 4px 12px rgba(109,40,217,0.08)",
        lg:    "0 12px 32px rgba(109,40,217,0.15)",
        inner: "inset 0 1px 2px rgba(109,40,217,0.06)",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.25, 0.1, 0.25, 1.0)",
      },

      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
      },

      animation: {
        "fade-in":   "fade-in 0.18s ease-out both",
        "slide-up":  "slide-up 0.22s ease-out both",
        "dropdown":  "slide-down 0.18s ease-out both",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
