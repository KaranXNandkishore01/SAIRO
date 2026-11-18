/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '380px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        sage: {
          50: '#f3f8f6',
          100: '#e1f0eb',
          200: '#c3e0d7',
          300: '#9bc9bc',
          400: '#72b0a0',
          500: '#539484',
          600: '#40776a',
          700: '#356056',
          800: '#2d4e47',
          900: '#27413c',
        },
        dusk: {
          950: '#0b1014',
          900: '#10171d',
          850: '#141d24',
          800: '#1a252e',
          700: '#253440',
        },
        mist: {
          50: '#f6f7f4',
          100: '#ecefe9',
          200: '#dce2d9',
        },
      },
      animation: {
        'breathe-slow': 'breathe 12s ease-in-out infinite',
        'fade-up': 'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-gentle': 'pulseGentle 2.8s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: '0.45' },
          '50%': { transform: 'scale(1.08) translate(12px, -10px)', opacity: '0.7' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGentle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.92)' },
        },
      },
    },
  },
  plugins: [],
};
