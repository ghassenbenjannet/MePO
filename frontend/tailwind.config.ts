import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f8fc",
        panel: "#ffffff",
        line: "#e2e8f0",
        ink: "#0f172a",
        muted: "#64748b",
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          500: "#4f46e5",
          600: "#4338ca",
        },
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
        },
      },
      fontFamily: {
        sans: ["'Segoe UI'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "app-surface":
          "radial-gradient(circle at top left, rgba(79, 70, 229, 0.08), transparent 28%), radial-gradient(circle at top right, rgba(16, 185, 129, 0.05), transparent 24%), linear-gradient(180deg, #fbfcff 0%, #f6f8fc 100%)",
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 23, 42, 0.06)",
        panel: "0 2px 10px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
