import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0d0505",
        card: "#1a0a0c",
        cardBorder: "#3a1418",
        gold: "#ffc72c",
        red: "#da291c",
        success: "#3fb950",
        warn: "#f0883e",
        muted: "#a68a8c",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
