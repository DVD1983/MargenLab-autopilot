/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        margen: {
          DEFAULT: '#0ea5e9',
          dark: '#0c4a6e'
        }
      }
    }
  },
  plugins: []
};