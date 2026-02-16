import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
        surface: { 50: "#f8fafc", 100: "#f1f5f9" },
      },
    },
  },
  plugins: [],
};
export default config;
