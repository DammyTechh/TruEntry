/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B4DE0',
          dark: '#001A66',
          hover: '#0940B8',
          light: '#EAF0FE',
          surface: '#F5F7FD',
        },
        border: '#E2E6F0',
        ink: '#0F172A',
        muted: '#6B7394',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,64,0.06), 0 1px 2px rgba(16,24,64,0.04)',
        pop: '0 8px 24px rgba(11,77,224,0.12)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(.98)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .4s ease-out both',
        'scale-in': 'scale-in .25s ease-out both',
      },
    },
  },
  plugins: [],
};
