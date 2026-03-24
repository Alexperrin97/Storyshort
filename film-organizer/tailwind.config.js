/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        film: {
          red: '#e63946',
          dark: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          muted: '#8b949e',
        },
      },
    },
  },
  plugins: [],
};
