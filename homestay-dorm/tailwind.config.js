/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      colors: {
        // === BRAND COLORS (Warm Hospitality) ===
        terracotta: {
          50:  '#FDF5F1',
          100: '#F9E5DC',
          200: '#F5C7B3',
          300: '#EFA589',
          400: '#E8895F',
          500: '#E07856',   // PRIMARY
          600: '#C5613F',
          700: '#A14E33',
          800: '#7D3D28',
          900: '#5C2D1D',
        },
        cream: {
          DEFAULT: '#FAF6F1',
          dark: '#E8DFD3',
        },
        warm: {
          white: '#FFFCF7',
        },
        ink: {
          DEFAULT: '#2D2420',
          soft: '#5C4F47',
          muted: '#8A7C72',
        },
        mint: {
          DEFAULT: '#7FB39C',
          light: '#C8E0D4',
          dark: '#5A8E78',
        },
        gold: {
          DEFAULT: '#D9A441',
          light: '#F0D9A8',
        },

        // === SHADCN/UI tokens (mapped to brand) ===
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-up": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
}
