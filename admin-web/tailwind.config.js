/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Preflight off so Tailwind utilities can be used in the new shell without
  // resetting the existing component CSS (.card/.btn/.table/etc.).
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // Admin uses an indigo/violet identity — distinct from the emerald app.
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        ink: '#1E1B4B',
      },
      boxShadow: {
        soft: '0 6px 24px rgba(30,27,75,0.08)',
        float: '0 12px 32px rgba(30,27,75,0.18)',
      },
      borderRadius: { xl2: '20px' },
    },
  },
  plugins: [],
};
