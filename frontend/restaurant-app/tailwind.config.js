/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Same palette as customer-app, except that surfaces which are white
      // there are light grey here, on a slightly darker grey page, so the
      // two apps are easy to tell apart at a glance.
      colors: {
        brand: {
          DEFAULT: '#6E2FF2',
          dark: '#5216D1',
          tint: '#F0EAFF',
        },
        charcoal: '#111115',
        muted: '#70707A',
        canvas: '#E6E6EA',
        panel: '#F4F4F6',
        divider: '#DCDCE1',
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
        'elevation-low': '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
        'elevation-high': '0 12px 32px 0 rgba(0, 0, 0, 0.10)',
      },
    },
  },
  plugins: [],
};
