import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        'surface-soft': 'hsl(var(--surface-soft))',
        'surface-muted': 'hsl(var(--surface-muted))',
        border: 'hsl(var(--border))',
        'border-soft': 'hsl(var(--border-soft))',
        primary: 'hsl(var(--primary))',
        'primary-light': 'hsl(var(--primary-light))',
        'primary-dark': 'hsl(var(--primary-dark))',
        secondary: 'hsl(var(--secondary))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
        card: '0 12px 32px rgba(15, 23, 42, 0.10)',
        premium: '0 20px 60px rgba(15, 23, 42, 0.16)',
        glow: '0 0 0 1px rgba(59, 130, 246, 0.20), 0 20px 60px rgba(59, 130, 246, 0.12)',
      },
      animation: {
        'fade-up': 'fadeUp 0.35s ease-out both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        'scale-in': 'scaleIn 0.22s ease-out both',
        'soft-pulse': 'softPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
    },
  },
  plugins: [],
}

export default config
