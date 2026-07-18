---
name: ActiveGrid
colors:
  surface: '#fbf8ff'
  surface-dim: '#d9d9e7'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ededfb'
  surface-container-high: '#e7e7f5'
  surface-container-highest: '#e1e1ef'
  on-surface: '#191b25'
  on-surface-variant: '#434656'
  inverse-surface: '#2e303a'
  inverse-on-surface: '#f0effe'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#506600'
  on-secondary: '#ffffff'
  secondary-container: '#c1f100'
  on-secondary-container: '#546b00'
  tertiary: '#4f4e4e'
  on-tertiary: '#ffffff'
  tertiary-container: '#676666'
  on-tertiary-container: '#e7e4e4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#c3f400'
  secondary-fixed-dim: '#abd600'
  on-secondary-fixed: '#161e00'
  on-secondary-fixed-variant: '#3c4d00'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#fbf8ff'
  on-background: '#191b25'
  surface-variant: '#e1e1ef'
  status-available: '#EDF2FF'
  status-booked: '#F1F3F5'
  status-hold: '#FFF4E6'
  success-green: '#00C853'
  error-red: '#FF3B30'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  price-display:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  container-margin: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The brand identity is built around the concept of "Performance in Motion." It targets urban athletes and recreational players who value efficiency and spontaneous activity. The UI must feel as responsive and energetic as the sports it facilitates (Futsal, Badminton, Table Tennis), transitioning from a high-energy landing experience to a hyper-functional, high-contrast booking utility.

The design style is **Corporate / Modern** with a **High-Contrast / Bold** edge. This approach ensures professional reliability for financial transactions while utilizing aggressive typography and vibrant accents to maintain an "athletic" spirit. We prioritize clarity in the scheduling grid—reducing cognitive load during the high-stakes moment of securing a court.

- **Visual Tone:** Professional, Energetic, Precise, and Accessible.
- **Vibe:** The digital equivalent of a fresh court floor—clean, marked with clear lines, and ready for action.

## Colors

The palette is anchored by "Athletic Blue" (#0052FF), a high-energy primary color that signals trust and action. It is paired with "Volt Green" (#CCFF00), a vibrant secondary accent used sparingly for call-to-actions and "active" states to draw immediate attention.

- **Primary (Athletic Blue):** Used for navigation, primary buttons, and selected time slots.
- **Secondary (Volt Green):** Used for critical high-conversion buttons and highlights.
- **Tertiary (Pitch Black):** Used for heavy typography to maintain high contrast.
- **Neutral:** A range of cool grays provides the structure for the scheduling grid, ensuring that the "Available" vs "Booked" status is immediately legible without color-blindness issues.
- **Status Colors:** Functional tints are used for the scheduling state-machine (Hold, Pending, Confirmed) to provide soft feedback without overwhelming the layout.

## Typography

The typographic system utilizes **Hanken Grotesk** for headlines to provide a sharp, contemporary "tech-meets-sport" aesthetic. Its bold weights are particularly effective for court names and venue headers.

**Inter** handles body copy and form inputs, chosen for its exceptional legibility on mobile devices and its neutral, systematic feel. 

For technical data—specifically time slots, booking codes, and currency—**JetBrains Mono** is introduced. This monospaced choice ensures that time columns in the grid align perfectly and provides a "data-driven" look that reinforces the precision of the booking platform.

- **Hierarchy:** Use `headline-xl` for landing page hero sections.
- **Utility:** Use `label-caps` for table headers and metadata (e.g., "WHATSAPP NUMBER").
- **Contrast:** Ensure all `headline` levels use the Tertiary (#121212) color for maximum punch.

## Layout & Spacing

The system follows a **mobile-first fluid grid**. On mobile, the layout relies on a single-column stack with 20px side margins. On desktop, the scheduling grid expands into a multi-column view allowing users to compare courts side-by-side.

- **The Schedule Grid:** This is the core component. It uses a fixed-height row system (48px per hour) to ensure vertical alignment across multiple court columns. 
- **Spacing Rhythm:** We use a 4px base unit. Component internal padding should favor "compact" (8px/12px) to maximize the amount of information visible on small screens.
- **Mobile Reflow:** In the `/jadwal` view, court columns become horizontally scrollable "cards" if more than two courts exist, ensuring the user can always see the time slots clearly.

## Elevation & Depth

To maintain the "Modern / Clean" aesthetic, depth is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Surface Levels:** 
    - Level 0: Background (White or #F8F9FA).
    - Level 1: Cards and Grid Containers (White with 1px border #E9ECEF).
    - Level 2: Modals and Floating Action Buttons (Subtle 15% opacity Athletic Blue shadow).
- **Depth Character:** Avoid physical skeuomorphism. Use light blue tints (#EDF2FF) to signify "Lift" on hoverable elements like available time slots. This creates a "digital-first" feel that is easy to render across all devices.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness level. This keeps the UI looking precise and athletic—sharp corners feel too aggressive (Brutalist), while pill-shapes feel too "social." 

- **Standard Elements:** Buttons, Input Fields, and Cards use `rounded` (4px).
- **Selection Indicators:** Small indicators (like the status dot in the admin dashboard) use `rounded-full` to stand out as geometric markers.
- **Large Containers:** On mobile, bottom sheets for booking confirmation use `rounded-t-lg` (8px) to provide a soft tactile feel when they slide up.

## Components

### Buttons
- **Primary:** Athletic Blue background, White text. High-contrast, no gradient.
- **Action (Book Now):** Volt Green background, Pitch Black text. Used for the final "Confirm Booking" step.
- **Secondary/Ghost:** 1px Athletic Blue border with transparent background.

### Schedule Grid Slots
- **Available:** White background with a subtle blue border. Turns Primary Blue on click/select.
- **Booked:** Light gray background (#F1F3F5) with a "Locked" icon or strike-through text.
- **Hold:** Pale orange background (#FFF4E6) with a countdown timer in JetBrains Mono.

### Inputs & Forms
- **Fields:** 1px border in gray-300. On focus, the border thickens and changes to Athletic Blue.
- **Validation:** Error messages appear in #FF3B30 (Error Red) with a 2px offset below the field.

### Cards (Venue/Court)
- Minimalist containers with high-quality images. Use `label-caps` for the sport type (e.g., "BADMINTON") as a badge in the top-right corner.

### Mobile Navigation
- A sticky bottom bar for the "Booking Summary" once slots are selected. This bar shows the total price and the "Proceed" button, ensuring the conversion path is always within thumb-reach.