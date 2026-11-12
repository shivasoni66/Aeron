/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Official AERON Aerospace Ground Control Palette
        background: "#0D141B",
        surface: "#151E27",
        "surface-elevated": "#192631",
        "surface-secondary": "#202F39",
        "surface-muted": "#121A22",
        border: "#334451",
        "border-subtle": "#2A3944",

        // Text Hierarchy
        "text-primary": "#F0F4F6",
        "text-secondary": "#B4C0C8",
        "text-muted": "#84939E",

        // AERON Signature Accents & Semantic Channels
        "aeron-lime": "#BFF42E",
        "accent-primary": "#BFF42E",
        "accent-soft": "#829E43",
        "telemetry-cyan": "#35C6D8",
        "navigation-blue": "#789BFF",
        "caution-amber": "#F2B95F",
        "critical-coral": "#F07878",
        "sar-violet": "#A78BFA",

        // Semantic status mappings
        success: "#79BD91",
        warning: "#F2B95F",
        danger: "#F07878",
        info: "#35C6D8",
        "status-danger": "#F07878",
        "status-warning": "#F2B95F",
        "status-info": "#35C6D8",
        "status-success": "#79BD91",

        // Backwards compatibility mappings for existing component classes
        "surface-dim": "#0D141B",
        "surface-bright": "#202F39",
        "surface-container-lowest": "#0A0F14",
        "surface-container-low": "#151E27",
        "surface-container": "#151E27",
        "surface-container-high": "#192631",
        "surface-container-highest": "#202F39",
        "surface-variant": "#1C2833",
        "on-surface": "#F0F4F6",
        "on-surface-variant": "#B4C0C8",
        "primary": "#F0F4F6",
        "on-primary": "#0D141B",
        "primary-container": "#BFF42E",
        "primary-fixed": "#BFF42E",
        "primary-fixed-dim": "#829E43",
        "on-primary-container": "#0D141B",
        "on-primary-fixed": "#0D141B",
        "secondary": "#B4C0C8",
        "secondary-container": "#202F39",
        "on-secondary": "#0D141B",
        "on-secondary-container": "#B4C0C8",
        "tertiary": "#35C6D8",
        "tertiary-container": "#172E38",
        outline: "#334451",
        "outline-variant": "#2A3944",
        error: "#F07878",
        "error-container": "#3A1B1F",
        "on-error": "#FFFFFF"
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        full: "9999px"
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2.5rem",
        gutter: "1.5rem"
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        mono: ["Space Mono", "monospace"],
        display: ["Anton", "sans-serif"],
        "display-hero": ["Anton", "sans-serif"],
        "headline-xl": ["Anton", "sans-serif"],
        "headline-lg": ["Anton", "sans-serif"],
        "headline-md": ["Manrope", "sans-serif"],
        "body-lg": ["Manrope", "sans-serif"],
        "body-md": ["Manrope", "sans-serif"],
        "body-sm": ["Manrope", "sans-serif"],
        "label-pill": ["Manrope", "sans-serif"],
        "label-telemetry": ["Space Mono", "monospace"]
      }
    }
  },
  plugins: []
};
