import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          100: "#dae7ff",
          500: "#4f46e5",
        },
        accent: {
          500: "#10b981",
        },
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(79, 70, 229, 0.10), transparent 30%), radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.10), transparent 35%)",
      },
      boxShadow: {
        soft: "0 16px 40px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
