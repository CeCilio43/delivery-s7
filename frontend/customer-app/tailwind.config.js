/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6E2FF2',
          dark: '#5216D1',
          tint: '#F0EAFF',
        },
        charcoal: '#111115',
        surface: '#1F1F24',
        muted: '#70707A',
        divider: '#F3F3F5',
        danger: '#EF4444',
        success: '#10B981',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Geist', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
      },
      boxShadow: {
        'elevation-low': '0 2px 8px 0 rgba(0, 0, 0, 0.03)',
        'elevation-high': '0 12px 32px 0 rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
