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
        primary: {
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        zeedo: {
          black: "#0a0a0a",
          white: "#fafafa",
          orange: "#f97316",
        },
        surface: { 50: "#fafafa", 100: "#f4f4f5" },
      },
    },
  },
  plugins: [],
};
export default config;
