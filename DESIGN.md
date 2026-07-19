---
name: Warm Vanguard
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#5a403f'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#8e706f'
  outline-variant: '#e2bebc'
  surface-tint: '#b52330'
  primary: '#b52330'
  on-primary: '#ffffff'
  primary-container: '#ff5a5f'
  on-primary-container: '#61000e'
  inverse-primary: '#ffb3b0'
  secondary: '#0453cd'
  on-secondary: '#ffffff'
  secondary-container: '#356ee7'
  on-secondary-container: '#fefcff'
  tertiary: '#7e5700'
  on-tertiary: '#ffffff'
  tertiary-container: '#c38900'
  on-tertiary-container: '#3e2900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b0'
  on-primary-fixed: '#410007'
  on-primary-fixed-variant: '#92001b'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b2c5ff'
  on-secondary-fixed: '#001848'
  on-secondary-fixed-variant: '#0040a2'
  tertiary-fixed: '#ffdeac'
  tertiary-fixed-dim: '#ffba35'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#5f4100'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
  background-warm: '#FAFAFA'
  surface-cream: '#FFFDFB'
  success-green: '#28A745'
  border-subtle: '#EAEAEA'
typography:
  eyebrow:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 80px
---

## Brand & Style

The design system is anchored in the concept of "Guided Ambition." It speaks to the "Pejuang" (warrior/fighter) spirit but softens it with a nurturing, communal layer. The target audience consists of students and young professionals seeking growth and community in a structured, residential environment.

We utilize a **Modern Minimalist** style infused with **warm, tactile elements**. This approach balances the professional reliability required for a residential service with the emotional warmth of a home. The UI features generous whitespace to reduce cognitive load, high-quality typography for clarity, and soft, diffused depth to create a welcoming, approachable atmosphere. It avoids the coldness of traditional corporate SaaS by using a refined coral palette and organic spacing rhythms.

## Colors

The palette is centered on a **Professional Coral** (`#FF5A5F`), which serves as the primary driver for action and brand identity. This specific hue is chosen to feel energetic and "human" rather than aggressive.

- **Primary (Coral):** Reserved for core CTAs, progress indicators, and active states.
- **Secondary (Deep Blue):** Used sparingly for trust indicators, links, and map markers to provide a grounded, institutional contrast.
- **Backgrounds:** We avoid pure white in favor of `background-warm` (`#FAFAFA`) to reduce eye strain and increase the "cozy" residential feel.
- **Neutrals:** Text and iconography use a softened black (`#1A1A1A`) to maintain high legibility without the harshness of high-contrast black on white.

## Typography

This design system uses **Plus Jakarta Sans** for all roles to achieve a cohesive, modern, and friendly geometric look. 

- **Headlines:** Feature tight letter-spacing and bold weights to convey strength and clarity.
- **Eyebrows:** Used for greetings like "Selamat Datang," these use a slightly wider letter-spacing and uppercase styling to establish hierarchy without competing with the H1.
- **Body:** Set with generous line height (1.5x) to ensure maximum readability for camp descriptions and rules. 
- **Hierarchy:** We prioritize a clear vertical rhythm. Mobile headlines are aggressively scaled down to ensure the "warrior" headlines never feel overwhelming on small screens.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid Grid**. Content is contained within a 1200px max-width container on desktop, centered to provide focus. 

- **Grid:** A 12-column system is used for desktop. Card layouts (Camp listings) should span 4 columns (3-up) or 6 columns (2-up) depending on content density.
- **Rhythm:** We use a strict 8px base unit. Section gaps are kept generous (80px+) to allow the design to "breathe," emphasizing the minimalist aesthetic.
- **Mobile:** On mobile devices, the grid collapses to a single column with 16px side margins. Cards transition from a grid-row to a vertical stack.

## Elevation & Depth

To maintain the "Modern Minimalist" feel, we avoid heavy shadows. Instead, we use **Ambient Tonal Layers**:

1.  **Level 0 (Base):** `background-warm` used for the main canvas.
2.  **Level 1 (Cards):** `surface-cream` with a very soft, high-diffusion shadow (`0px 4px 20px rgba(0,0,0,0.04)`). This makes the camp cards feel like they are resting gently on the surface.
3.  **Level 2 (Interactive):** On hover, cards lift slightly with a more pronounced shadow (`0px 12px 32px rgba(0,0,0,0.08)`) and a subtle 1px border in `primary_color`.

This depth model ensures a tactile experience that feels "human-designed" rather than flat and clinical.

## Shapes

The shape language is defined by **Soft Geometricity**. 

A `roundedness` of **2** (0.5rem base) is applied to all standard components like input fields and small buttons. Larger components, such as Camp Cards and "Join" CTAs, use `rounded-xl` (1.5rem) to evoke a friendly, approachable, and safe environment. This softer corner radius helps counteract the potentially "hard" connotations of the word "Pejuang."

## Components

### Buttons
- **Primary:** Filled `primary_color_hex` with white text. Large padding (16px 32px) and `rounded-xl` shape.
- **Secondary:** Ghost style with a `primary_color_hex` border and text. Used for "Lihat Detail" actions.

### Cards (Camp Listings)
- Cards must feature a high-quality image at the top with a fixed aspect ratio (4:3).
- Content padding is generous (24px).
- Metadata (floors, capacity) should use `label-sm` with small, secondary-colored icons to create a scannable "at-a-glance" experience.

### Input Fields
- Use `surface-cream` background with a `border-subtle`. On focus, the border transitions to the primary coral. Labels are always persistent above the field.

### Trust Indicators (Testimonials/Stats)
- Testimonial cards use a subtle italic `body-md` and include a small avatar.
- Stats (e.g., "500+ Alumni") use `headline-md` in the primary color to draw immediate attention.

### Chips
- Used for gender labels (Putra/Putri). These use low-saturation versions of secondary colors (soft blue/soft pink) with `label-sm` text to provide clear categorization without visual noise.