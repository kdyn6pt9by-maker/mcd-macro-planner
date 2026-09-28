import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        base: "#0b0405",
        card: "#1a0a0c",
        cardBorder: "#3a1418",
        gold: "#ffc72c",
        red: "#da291c",
        success: "#34d399",
        warn: "#fb923c",
        muted: "#b39597",
        carb: "#d6a15c",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
