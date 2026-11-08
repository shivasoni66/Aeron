---
name: Aerospace Telemetry High-Voltage
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#202020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c9ae'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#303030'
  outline: '#8d937a'
  outline-variant: '#434934'
  surface-tint: '#a5d700'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#bff42e'
  on-primary-container: '#526d00'
  inverse-primary: '#4d6700'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e3e2e2'
  on-tertiary-container: '#646465'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#bff42e'
  primary-fixed-dim: '#a5d700'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#394d00'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-hero:
    fontFamily: Anton
    fontSize: 112px
    fontWeight: '400'
    lineHeight: 104px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Anton
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 58px
    letterSpacing: 0.01em
  headline-xl:
    fontFamily: Anton
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 68px
    letterSpacing: 0.02em
  headline-xl-mobile:
    fontFamily: Anton
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: 0.01em
  headline-lg:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 42px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-telemetry:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-pill:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system defines an authoritative, high-performance interface language tailored for autonomous flight platforms, telemetry analytics, and aerospace hardware showcases. It combines technical military-grade aviation utility with aggressive luxury motorsport aesthetics. 

The visual style unites **High-Contrast Bold** with **Precision Brutalism** and subtle **Glassmorphism**:
- Deep void canvas tones evoke carbon fiber fuselage textures and night mission cockpits.
- Pure white display typography interlocks directly behind and through physical quadcopter hardware renders to achieve dramatic spatial depth.
- Razor-thin orbital telemetry rings, angular coordinate nodes, and high-voltage neon lime accents evoke targeting HUDs, avionics sensors, and battery health telemetry.
- Asymmetric editorial layouts break rigid SaaS grids to celebrate industrial design craft, speed, and uncompromising durability.

## Colors

The palette operates under an intense dark-field environment designed for zero glare and high daylight-to-night legibility.

- **Primary (`#C9FF3A`) — Neon Lime Green:** Electric accent reserved for high-priority telemetry triggers, key performance metrics, highlight cards, active pill states, and critical actions. Used surgically to prevent visual exhaustion.
- **Secondary (`#F3F3F3`) — Crisp Off-White:** Secondary actionable surfaces, high-contrast badge fills, crisp icon vectors, and interactive button baselines.
- **Tertiary (`#AFAFAF`) — Muted Radar Grey:** Metadata text, secondary flight statistics, unselected nav labels, orbital telemetry rings, and sub-headings.
- **Neutral (`#202020`) — Deep Charcoal:** The dominant canvas background. Extended across surface containers:
  - Base Background: `#181818` to `#202020`
  - Elevated Container / Cards: `#282828`
  - Overlay Stroke / Ghost Border: `rgba(255, 255, 255, 0.12)`
  - Active Neon Container: `#C9FF3A` with saturated dark ink `#111111` for foreground elements.
- **Display White (`#FFFFFF`):** Reserved exclusively for heavy, oversized typography and hero titles.

## Typography

The typography structure reflects aerospace flight dynamics:

1. **Display & Massive Hero Headings:** Powered by `Anton`. High-impact, vertical, condensed proportions designed to run at gigantic scales (`112px+`). Applied with uppercase styling, slight tracking, and layered underneath or piercing physical drone 3D renders.
2. **Editorial Subheadings & Body:** Handled by `Manrope`. Provides crisp geometric clarity, neutral warmth, and uncompromised legibility on high-resolution displays.
3. **Avionics & Telemetry Metadata:** Handled by `Space Mono`. All coordinates, battery percentages, flight velocity, HUD orbit labels, and component part tags use this monospaced layer to emphasize technical precision.

## Elevation & Depth

Visual hierarchy uses surface luminance steps, structural hairline strokes, and radiant neon back-glows:

- **Level 0 (Atmosphere):** Pure dark field `#202020`. No elevation.
- **Level 1 (Sub-Panel / Neutral Cards):** Tinted carbon surface `#282828` encased with a 1px ghost border (`rgba(255, 255, 255, 0.08)`). No heavy drop shadows.
- **Level 2 (Telemetry Overlays & Floating Navigation Dock):** High-density dark glass `#252525` at 88% opacity, backed by `backdrop-filter: blur(24px)` and a 1px border of `rgba(255, 255, 255, 0.16)`.
- **Level 3 (Neon Surge Cards):** Solid `#C9FF3A` surface. Grounded with an ambient high-voltage glow: `box-shadow: 0 16px 40px -10px rgba(201, 255, 58, 0.28)`.
- **Telemetry HUD Rings:** Fine circular vector strokes (1px, `rgba(255, 255, 255, 0.15)`) decorated with dynamic percentage arc points filled in `#C9FF3A`.

## Shapes

The design system embraces a **Pill-Centric (`3`)** shape language contrasted against large soft-cornered industrial cards:

- **Buttons, Badges, Search Bars, and Docks:** True full-pill geometries (`border-radius: 9999px` / token `rounded-full`). These shapes deliver a sleek aerodynamic pebble silhouette reminiscent of high-end flight controllers and goggles.
- **Product & Telemetry Cards:** Balanced soft radiuses (`24px` to `32px` on desktop; `18px` to `20px` on mobile).
- **Technical HUD Orbit Nodes:** Absolute circles (`50%` radius) intersecting vector guide paths.

## Components

### Buttons
- **Primary Pill:** Background in `#C9FF3A`, text in `#111111` (`label-pill`), full pill radius. Includes a trailing arrow icon (`→`). Hover produces an inner brightness surge and an external `#C9FF3A` radial halo.
- **Ghost Action Pill:** Transparent fill, 1px border in `rgba(255, 255, 255, 0.3)`, text in `#F3F3F3`. On hover, transitions to border `#FFFFFF` and background `rgba(255, 255, 255, 0.06)`.
- **White Utility Pill:** Solid `#FFFFFF` fill, `#181818` text, full pill radius. Used for product specification toggles and modal confirmation.

### High-Voltage Feature Cards
- **Electric Accent Card:** Saturated `#C9FF3A` background, pure black text. Houses specialized model tags, quick-spec indicators, and hardware previews.
- **Carbon Standard Card:** `#282828` background with 1px border in `rgba(255, 255, 255, 0.08)`. Features off-white `#F3F3F3` titles, `#AFAFAF` descriptive copy, and a floating pill call-to-action in the corner.

### Telemetry Orbit Rings & HUD Markers
- Circular vector telemetry indicators framing hardware components.
- Nodes along the arc showcase active payload status, sensor durability percentages, and FOV angles using `label-telemetry` text.

### Floating Mobile App Dock
- Floating bottom tab bar anchored 24px above screen bottom.
- Frosted dark charcoal fill (`#222222`), `blur(20px)`, rounded-full pill outline.
- Active state renders as an inverted white pill capsule surrounding high-contrast black vector icons.

### Inputs & Search Bars
- Elongated pill input containers with `#282828` background and inset borders. Placeholder text in `#AFAFAF`. Focused state triggers a crisp 1px stroke in `#C9FF3A`.