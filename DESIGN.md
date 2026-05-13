---
name: The Darkroom Narrative
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c7c6c6'
  on-secondary: '#2f3131'
  secondary-container: '#484949'
  on-secondary-container: '#b8b8b8'
  tertiary: '#ffffff'
  on-tertiary: '#313030'
  tertiary-container: '#e5e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
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
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-tablet: 32px
  margin-mobile: 16px
---

## Brand & Style

This design system is built on the concept of the "digital gallery"—a space where the UI recedes into the background to let professional photography command the viewer's full attention. It adopts a **Minimalist** and **High-Contrast** style, drawing inspiration from high-end editorial magazines and physical art galleries.

The brand personality is sophisticated, quiet, and precise. It targets professional photographers and enthusiasts who value craft over social noise. The emotional response should be one of "focused calm"—evoking the feeling of a quiet darkroom where the only thing that matters is the image emerging from the shadows. 

Key visual principles include:
- **Hero Imagery:** Content is never crowded; images are given ample breathing room.
- **Architectural Rigor:** Elements are aligned to a strict grid, creating a sense of structural integrity.
- **Monochromatic Sophistication:** Color is used only for the photographs themselves, ensuring no UI element competes with the user's work.

## Colors

The palette is strictly monochromatic to maintain the "darkroom" aesthetic. The primary theme is a deep, immersive dark mode.

- **Deep Blacks (#050505):** Used for the canvas/background to provide maximum contrast for imagery.
- **Rich Charcoals (#121212, #1A1A1A):** Used for surface elevation and container backgrounds to differentiate layers without breaking the dark aesthetic.
- **Soft Off-Whites (#F5F5F5):** Reserved for primary typography and essential UI actions to ensure legibility and a premium feel.
- **Muted Grays (#666666):** Used for secondary meta-data and decorative borders, ensuring they remain subordinate to the photography.

## Typography

The typographic scale relies on the tension between a romantic, high-contrast serif and a functional, utilitarian sans-serif.

- **Headlines:** Use **Playfair Display**. It provides an editorial "masthead" feel. Use generous tracking (letter spacing) for titles in all-caps scenarios to enhance the luxury aesthetic.
- **UI & Body:** Use **Inter**. It is selected for its exceptional legibility at small sizes and its neutral character, which prevents the UI from feeling dated or overly decorative.
- **Labels:** Meta-data (ISO settings, shutter speeds, etc.) should be set in Inter, often using `label-sm` with uppercase styling and increased letter spacing to mimic technical camera displays.

## Layout & Spacing

This design system utilizes a **Fixed Grid** philosophy for desktop to maintain a gallery-like composition, transitioning to a **Fluid Grid** for mobile devices.

- **Desktop (1440px):** A 12-column grid with wide 64px margins. This "oversized" margin acts as a physical frame for the content.
- **Mobile:** A 4-column grid with 16px margins.
- **Rhythm:** All spacing must be a multiple of 4px. Use generous vertical padding between sections (80px+) to allow images to exist in isolation.
- **The "Frame" Ratio:** Whenever possible, image containers should respect traditional photographic aspect ratios (3:2, 4:5, 1:1) to maintain the integrity of the medium.

## Elevation & Depth

To maintain the minimalist aesthetic, depth is created through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows.

- **Levels:** 
    - **L0 (Base):** Rich Black (#050505).
    - **L1 (Cards/Surface):** Charcoal (#121212) with a 1px solid border (#222222).
    - **L2 (Modals/Popovers):** Deep Gray (#1A1A1A) with a subtle ambient shadow (0px 8px 24px rgba(0,0,0,0.5)).
- **Borders:** Use thin, 1px borders to define edges. This mimics the thin metal frames of professional photography prints. 
- **Backdrop:** Use a heavy background blur (20px+) for overlays to maintain a sense of context while keeping the focus on the foreground action.

## Shapes

The shape language is **Sharp (0)**. 

Every element—from image containers to buttons—uses 0px corner radii. This creates a precision-engineered, architectural look. The absence of rounded corners reinforces the "Frame" concept, echoing the sharp edges of a printed photograph or a gallery wall. 

Small UI icons may retain their internal curves for legibility, but their bounding containers must always be rectangular and sharp.

## Components

### Buttons
- **Primary:** Solid Off-White background with Black text. Sharp corners. All-caps `label-lg` typography.
- **Secondary:** Transparent background with a 1px Off-White border. 
- **Ghost:** No border, Off-White text, subtle hover state (background opacity change).

### Input Fields
- Underline style only. A 1px border on the bottom of the field. Label sits above in `label-sm`. Focus state changes border color from Dark Gray to White.

### Cards (Gallery Items)
- No shadows. A 1px border (#222222) defines the edge. 
- Captions and meta-data appear only on hover or are placed clearly below the image with significant whitespace.

### Chips / Tags
- Small, rectangular boxes with 1px borders. Text is `label-sm` in all-caps. No fill color unless active.

### The "Loupe" (Custom Component)
- A specialized circular zoom component for inspecting high-resolution details. It should feature a high-contrast white border and a 1:1 magnification ratio.

### Progress Bars
- Extremely thin (2px). Uses the primary Off-White color against a Charcoal track. No rounded ends.
