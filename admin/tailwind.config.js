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
        "background": "#131313",
        "surface": "#131313",
        "surface-dim": "#131313",
        "surface-bright": "#393939",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1b1c1c",
        "surface-container": "#202020",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353535",
        "surface-variant": "#353535",
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#c4c9ae",
        "primary": "#ffffff",
        "on-primary": "#273500",
        "primary-container": "#bff42e",
        "primary-fixed": "#bff42e",
        "primary-fixed-dim": "#a5d700",
        "on-primary-container": "#526d00",
        "on-primary-fixed": "#151f00",
        "secondary": "#c6c6c7",
        "secondary-container": "#454747",
        "on-secondary": "#2f3131",
        "on-secondary-container": "#b4b5b5",
        "tertiary": "#ffffff",
        "tertiary-container": "#e3e2e2",
        "outline": "#8d937a",
        "outline-variant": "#434934",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005"
      },
      borderRadius: {
        "sm": "0.5rem",
        "DEFAULT": "1rem",
        "md": "1.5rem",
        "lg": "2rem",
        "xl": "3rem",
        "full": "9999px"
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2.5rem",
        "gutter": "1.5rem"
      },
      fontFamily: {
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

