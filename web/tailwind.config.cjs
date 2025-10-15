module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F8F6F2',
        card: '#FFFFFF',
        primary: '#E36549',
        text: '#1F2937',
        muted: '#6B7280'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem'
      }
    },
  },
  plugins: [],
};
