/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#2196f3",
          dark: "#64b5f6",
        },
        secondary: {
          light: "#4caf50",
          dark: "#81c784",
        },
        danger: {
          light: "#f44336",
          dark: "#e57373",
        },
        background: {
          light: "#f3f4f6",
          dark: "#121212",
        },
        surface: {
          light: "#ffffff",
          dark: "#1e1e1e",
        },
        text: {
          light: "#1f2937",
          dark: "#e5e7eb",
        },
      },
      animation: {
        "bounce-slow": "bounce 3s infinite",
        "pulse-slow": "pulse 3s infinite",
      },
    },
  },
  plugins: [],
};
