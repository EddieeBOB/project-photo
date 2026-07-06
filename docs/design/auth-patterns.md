---
name: Luminous Editorial - Auth Patterns
version: 1.0.0
author: Stitch AI
description: Extension of the Luminous Editorial design system focusing on authentication flows (Login and Sign Up). These patterns maintain the "Frame" aesthetic of high-fidelity minimalism and editorial clarity.

## Auth Visual Philosophy
- **Focus and Clarity:** Authentication screens are designed with significant central focus, stripping away distractions to prioritize the user's journey into the platform.
- **Visual Continuity:** Utilizing background imagery that mirrors the platform's high-fidelity photographic focus, often using architectural or minimalist subjects in high-key lighting.
- **Editorial Gravity:** Large, expressive serif headlines provide a welcoming, high-end feel, contrasting with functional, precise form fields.

## Page Layout & Structure
- **Container:** Centered white surface containers (`bg-surface-bright`) with subtle borders (`border-outline-variant/30`) and soft shadows or flat treatments depending on the depth of the background.
- **Vertical Rhythm:**
  - Top: Standard `TopAppBar` with persistent navigation.
  - Center: Headline followed by a sub-headline, then the primary form.
  - Bottom: Footer with legal and utility links.
- **Background Imagery:** Integrated high-resolution photographic assets placed asymmetrically to create balance with the centered form (e.g., bottom-left or bottom-right placement).

## Component Specifications: Auth Forms
### Headlines
- **Typography:** Playfair Display, Headline Large (48px - 64px).
- **Copy:** Emotional and welcoming ("Welcome Back", "Join the Community").

### Input Fields
- **Container:** Rectangular with sharp or minimally rounded corners (4px).
- **Background:** `bg-surface-container-low` (#F3F3F3).
- **Labels:** Sans-serif, Label Large (14px), Uppercase, tracked out (0.1em).
- **Placeholder:** Muted secondary text (#44474E).
- **Interaction:** Subtle border or background shift on focus.

### Primary Actions (Buttons)
- **Style:** Solid Black (#000000) with White text.
- **Typography:** Sans-serif, Label Large, Uppercase, Bold.
- **Sizing:** Full-width within the form container, generous height (48px - 56px).

### Secondary Links
- **Style:** Underlined text or high-contrast bold for "Sign Up" / "Sign In" calls to action.
- **Placement:** Positioned below the primary button or within the form metadata (e.g., "Forgot Password?").

## Interaction States
- **Hover:** Buttons maintain solid color but may have a slight opacity shift.
- **Validation:** Clean, minimalist error states using high-contrast text or subtle red accents if necessary, though the primary system avoids vibrant colors.

## Accessibility
- **Contrast:** High-contrast Charcoal-on-Off-White (#1A1C1E on #F9F9F9) ensures WCAG AA compliance for all functional text.
- **Touch Targets:** Buttons and input fields maintain a minimum height of 44px for ease of interaction.
