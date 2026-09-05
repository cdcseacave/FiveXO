/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        board: {
          bg: '#0f141c',
          grid: '#1e293b',
          wood: '#d29a53',
          'wood-dark': '#8b5a2b',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.5)',
      }
    },
  },
  plugins: [],
}
