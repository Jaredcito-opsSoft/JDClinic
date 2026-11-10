/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinic: {
          canvas: '#F8F5F0',
          surface: '#FFFCF8',
          soft: '#F1EAF4',
          line: '#E7DEE7',
          ink: '#282638',
          muted: '#756E7C',
          brand: '#59456D',
          deep: '#423251',
          accent: '#D8634C',
          'accent-soft': '#FFF0E9',
        },
        clinical: {
          50:  '#F7F1F8',
          100: '#F1EAF4',
          200: '#E3D7EA',
          600: '#59456D',
          700: '#423251',
          900: '#282638',
          brand: '#59456D',
        },
        /* Azul reservado para información y estados secundarios. */
        sky: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#2563A6',
          700: '#1F518B',
          800: '#183F6E',
          900: '#122F54',
        },
        /* ─ Superficies ─ */
        canvas: '#F8F5F0',
        surface: {
          DEFAULT: '#FFFFFF',
          muted:   '#F8F5F0',
          border:  '#E7DEE7',
        },
        /* ─ Semánticos ─ */
        critical: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          700: '#B91C1C',
        },
        stable: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          600: '#059669',
          700: '#047857',
        },
        warn: {
          50:  '#FFFBEB',
          600: '#D97706',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'sm':     '0 1px 2px 0 rgba(0,0,0,0.05)',
        'card':   '0 2px 8px -1px rgba(0,0,0,0.06), 0 1px 3px -1px rgba(0,0,0,0.04)',
        'header': '0 1px 0 0 rgba(0,0,0,0.06)',
        'pop':    '0 8px 24px -4px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
