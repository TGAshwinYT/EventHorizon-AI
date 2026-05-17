/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#FAFAF7", // light
          dark: "#0D1F16"
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#142c1f"
        },
        primary: {
          DEFAULT: "#1A4731",
          light: "#256445"
        },
        secondary: {
          DEFAULT: "#F5A623",
          light: "#f7b74f"
        },
        accent: "#4A90D9",
        success: "#2ECC71",
        warning: "#F39C12",
        danger: "#E74C3C",
        text: {
          light: "#1C1C1E",
          dark: "#F5F5F0"
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
