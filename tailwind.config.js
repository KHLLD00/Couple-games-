export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1E1030',
        plum: '#2C1745',
        cherry: '#FF4D6D',
        apricot: '#FFB86B',
        mint: '#6FE3C4',
        cream: '#FFF3E6'
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}
