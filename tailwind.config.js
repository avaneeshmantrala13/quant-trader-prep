/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables (see index.css). Every token
        // resolves to a contrast-safe value in BOTH the "newsprint" light theme
        // and the "terminal" dark theme.
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised) / <alpha-value>)",
        "surface-muted": "rgb(var(--color-surface-muted) / <alpha-value>)",
        subtle: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        primary: "rgb(var(--color-text-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
        muted: "rgb(var(--color-text-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--color-accent-hover) / <alpha-value>)",
        "accent-contrast": "rgb(var(--color-accent-contrast) / <alpha-value>)",
        "accent-2": "rgb(var(--color-accent-2) / <alpha-value>)",
        "accent-2-hover": "rgb(var(--color-accent-2-hover) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        "success-soft": "rgb(var(--color-success-soft) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "danger-soft": "rgb(var(--color-danger-soft) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        bull: "rgb(var(--color-bull) / <alpha-value>)",
        bear: "rgb(var(--color-bear) / <alpha-value>)",
      },
      textColor: {
        primary: "rgb(var(--color-text-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
        muted: "rgb(var(--color-text-muted) / <alpha-value>)",
      },
      fontFamily: {
        // Theme-driven: each theme sets --font-* (see src/themes). Defaults
        // for these variables live in index.css so text is never fontless.
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        // Theme-driven corner radii (see src/themes). rounded-full stays full.
        none: "0",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
      },
      letterSpacing: {
        label: "0.14em",
      },
      keyframes: {
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "candle-drift": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "draw-path": {
          "0%": { strokeDashoffset: "300" },
          "55%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        blink: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        "stamp-in": {
          "0%": { transform: "scale(2.4) rotate(-18deg)", opacity: "0" },
          "60%": { transform: "scale(0.92) rotate(-11deg)", opacity: "1" },
          "80%": { transform: "scale(1.04) rotate(-13deg)" },
          "100%": { transform: "scale(1) rotate(-12deg)", opacity: "1" },
        },
        "rise-fade": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "20%": { transform: "translateY(0)", opacity: "1" },
          "80%": { transform: "translateY(-6px)", opacity: "1" },
          "100%": { transform: "translateY(-26px)", opacity: "0" },
        },
        "print-in": {
          "0%": { transform: "translateY(8px)", opacity: "0", filter: "blur(1px)" },
          "100%": { transform: "translateY(0)", opacity: "1", filter: "blur(0)" },
        },
        "flash-row": {
          "0%": { backgroundColor: "rgb(var(--color-accent) / 0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
        "node-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "70%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "ticker-scroll": "ticker-scroll 40s linear infinite",
        "candle-drift": "candle-drift 60s linear infinite",
        "draw-path": "draw-path 14s ease-in-out infinite",
        blink: "blink 1.1s step-end infinite",
        "stamp-in": "stamp-in 0.5s cubic-bezier(0.2,0.9,0.3,1.2) both",
        "rise-fade": "rise-fade 1.6s ease-out both",
        "print-in": "print-in 0.4s ease-out both",
        "flash-row": "flash-row 0.8s ease-out",
        "node-pop": "node-pop 0.4s cubic-bezier(0.2,0.9,0.3,1.4) both",
      },
    },
  },
  plugins: [],
};
