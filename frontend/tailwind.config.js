/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#060910',
          900: '#0c1322',
          800: '#162035',
          700: '#233252',
        }
      }
    },
  },
  plugins: [],
}
