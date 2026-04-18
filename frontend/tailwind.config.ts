import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--bg-body)",
        panel: "var(--bg-panel)",
        panel2: "var(--bg-panel-2)",
        panel3: "var(--bg-panel-3)",
        border: "var(--border)",
        ink: "var(--text-strong)",
        muted: "var(--text-muted)",
        line: "var(--border)",

        sidebar: {
          DEFAULT: "var(--bg-sidebar)",
          item: "var(--bg-sidebar-item)",
          active: "var(--bg-sidebar-active)",
          border: "var(--sidebar-border)",
          text: "var(--sidebar-text)",
          muted: "var(--sidebar-muted)",
          section: "var(--sidebar-section)",
          accent: "var(--sidebar-accent)",
        },

        brand: {
          DEFAULT: "var(--color-brand-500)",
          50: "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
          800: "var(--color-brand-800)",
          900: "var(--color-brand-900)",
        },

        zinc: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },

        accent: {
          DEFAULT: "#B7D94C",
          50: "#F6FBE6",
          100: "#EEF6D3",
          200: "#DDEB9B",
          300: "#CDE068",
          400: "#BDD551",
          500: "#B7D94C",
          600: "#A9CB42",
          700: "#94B436",
        },

        danger: {
          50: "#FCEAEA",
          100: "#F9D4D1",
          200: "#F5BBB5",
          400: "#EB8C87",
          500: "#EB8C87",
          600: "#D97873",
        },

        warn: {
          50: "#FFF3DD",
          100: "#FBE7B8",
          400: "#F2C66D",
          500: "#F2C66D",
          600: "#DAAF5D",
        },

        info: {
          50: "#EAF2FF",
          100: "#D7E7FF",
          400: "#9FC3F7",
          500: "#9FC3F7",
          600: "#82AFEC",
        },

        violet: {
          50: "#F0EEFF",
          100: "#E6E1FF",
          400: "#A4A0FA",
          500: "#8D8CF6",
          600: "#7573E7",
        },

        dark: {
          body: "#1C201B",
          panel: "#232722",
          p2: "#2A2F29",
          p3: "#313630",
          bdr: "#464B45",
          text: "#D4D7D3",
          hi: "#F2F3F3",
          muted: "#9DA391",
        },

        anchor: {
          DEFAULT: "#393F38",
          light: "#4F5A4E",
          dim: "#2A2F29",
        },

        moss: {
          DEFAULT: "#9DA391",
          light: "#B8BDB3",
          dark: "#7A7F6E",
        },
      },

      fontFamily: {
        sans: ['"Inter Tight"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        display: ['"Instrument Serif"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "Menlo", "monospace"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "1.5" }],
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.6" }],
        base: ["14px", { lineHeight: "1.6" }],
        md: ["15px", { lineHeight: "1.55" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.45" }],
        "2xl": ["20px", { lineHeight: "1.4" }],
        "3xl": ["24px", { lineHeight: "1.35" }],
      },

      borderRadius: {
        sm: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "28px",
        "4xl": "32px",
      },

      boxShadow: {
        sm: "var(--shadow-sm)",
        panel: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        float: "var(--shadow-lg)",
        soft: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        brand: "var(--shadow-brand)",
        inner: "inset 0 1px 2px rgba(15,23,42,0.06)",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },

      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
      },

      animation: {
        "fade-in": "fade-in 0.18s ease-out both",
        "slide-up": "slide-up 0.22s ease-out both",
        dropdown: "slide-down 0.18s ease-out both",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
