module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'navy-900': '#070d18',
        'navy-800': '#0b1726',
        'glass-1': 'rgba(255,255,255,0.04)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    },
  },
  plugins: [],
};
