/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      spacing: { '4.5': '1.125rem', '18': '4.5rem' },
      colors: {
        // Royal indigo-blue system — mature, institutional, matches the design.
        // Brand blue, sampled from the logo (#002A84 navy / #0042C0 blue).
        // Deliberately deep rather than bright — institutional, not neon.
        primary: {
          DEFAULT: '#0F47CC',
          50: '#EFF4FF',
          100: '#DBE6FF',
          200: '#BACFFF',
          300: '#8CAEFF',
          400: '#5585FA',
          500: '#2C61EE',
          600: '#1550DA',
          700: '#0F47CC',
          800: '#0B3BA8',
          900: '#08307F',
          950: '#002A7E',
          dark: '#002A7E',
          hover: '#0B3BA8',
          light: '#EFF4FF',
          surface: '#F6F8FD',
        },
        border: '#E6E8F0',
        ink: '#0E1330',
        muted: '#5B6478',
        success: '#15A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // slightly tighter, more editorial display sizes
        'display': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '800' }],
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '22px' },
      boxShadow: {
        xs: '0 1px 2px rgba(14,19,48,0.04)',
        card: '0 1px 2px rgba(14,19,48,0.04), 0 1px 3px rgba(14,19,48,0.03)',
        soft: '0 2px 8px rgba(14,19,48,0.05)',
        lift: '0 8px 28px -14px rgba(14,19,48,0.18)',
        pop: '0 16px 40px -20px rgba(53,56,205,0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(150deg, #2C61EE 0%, #0F47CC 52%, #002A7E 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.21,.6,.35,1) both',
        'fade-in': 'fade-in .4s ease-out both',
      },
    },
  },
  plugins: [],
};
