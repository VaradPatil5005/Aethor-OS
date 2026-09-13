/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#0f172a',
          window: '#1e293b',
          bar: '#020617',
          accent: '#6366f1'
        }
      }
    },
  },
  plugins: [],
}
