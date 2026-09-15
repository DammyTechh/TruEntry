/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      spacing: { '4.5': '1.125rem', '18': '4.5rem' },
      colors: {
        // Royal indigo-blue system — mature, institutional, matches the design.
        primary: {
          DEFAULT: '#3538CD',
          50: '#EEF0FF',
          100: '#E0E3FF',
          200: '#C7CBFE',
          300: '#A5A9FB',
          400: '#8184F6',
          500: '#6366EE',
          600: '#4F46E5',
          700: '#3538CD',
          800: '#2D2FA6',
          900: '#282B83',
          950: '#1A1B4B',
          dark: '#1A1B4B',
          hover: '#2D2FA6',
          light: '#EEF0FF',
          surface: '#F7F8FC',
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
        'brand-gradient': 'linear-gradient(150deg, #4F46E5 0%, #3538CD 55%, #1A1B4B 100%)',
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
