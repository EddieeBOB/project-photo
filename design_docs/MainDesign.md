---
name: Luminous Editorial
version: 1.0.0
author: Stitch AI
description: A bright, airy, and sophisticated design system for Frame, a high-fidelity photo-sharing platform. The system prioritizes "Luminous Editorial" aesthetics, emphasizing generous whitespace, intentionality, and high-resolution visual storytelling.

## Visual Philosophy
- **Intentionality over Velocity:** Layouts are designed to slow the user down, favoring large-scale imagery and horizontal movement.
- **Minimalist Sophistication:** Thin lines, subtle borders, and a restricted color palette ensure the interface recedes to let the photography lead.
- **Editorial Authority:** Use of high-contrast serif typography for headings to evoke the feeling of a premium print journal.

## Color Palette
### Surface & Backgrounds
- **Surface (Default):** `#F9F9F9` (Light, airy off-white)
- **Surface Bright:** `#FFFFFF` (Pure white for containers and elevated cards)
- **Surface Container Low:** `#F3F3F3` (Subtle grey for section backgrounds and secondary zones)
- **Backdrop Blur:** `bg-surface/80` with `backdrop-blur-xl` for persistent UI elements like navigation.

### Typography & Icons
- **On-Surface (Primary):** `#1A1C1E` (High-contrast charcoal for maximum legibility)
- **On-Surface Variant (Secondary):** `#44474E` (Muted grey for descriptions and secondary metadata)
- **Primary Action:** `#000000` (Solid black for high-impact buttons and primary calls to action)

### Accents & Borders
- **Outline Variant:** `rgba(0, 0, 0, 0.1)` (Ultra-thin, light borders for structure without weight)
- **Focus/Active:** `#000000` (Used for active navigation underlines and interactive states)

## Typography
### Headlines (Playfair Display)
- **Headline Large:** 48px - 64px, Light weight, Tight tracking. Used for hero titles and major section headers.
- **Headline Medium:** 32px - 40px, Semi-bold or Regular. Used for gallery titles and featured artist names.
- **Headline Small:** 24px - 28px. Used for sub-sections and card titles.

### UI & Body (Sans-Serif)
- **Body Large:** 18px. For introductory copy and lead paragraphs.
- **Body Medium:** 14px - 16px. Standard body copy.
- **Label Large:** 14px, Uppercase, Widest tracking (0.1em). Used for navigation links and section labels (e.g., "EXHIBITION NO. 12").
- **Label Medium/Small:** 11px - 12px. Used for technical metadata (EXIF data) and copyright text.

## Component Patterns
### TopAppBar
- **Structure:** Fixed, full-width, 64px height.
- **Style:** `bg-surface/80 backdrop-blur-xl`.
- **Navigation:** Centered links with a 1px border-bottom on active state.
- **Actions:** Icons on the right (Search, Account) and a primary "Inquire" button.

### Hero Section (Landing Page)
- **Composition:** Split layout. Left side features large serif headline and descriptive copy with dual-action buttons (Primary: Solid Black, Secondary: Outlined).
- **Visuals:** Right side features an immersive mockup of a smartphone displaying high-fidelity photography in a gallery setting, utilizing soft shadows and realistic lighting.

### Feature Cards
- **Structure:** Equal-width grid cells (typically 3-column).
- **Style:** Bordered containers (`border-outline-variant`), subtle padding, and minimalist icons.
- **Content:** Icon at the top left, followed by a bold title and concise value proposition.

### Gallery Carousel (The Silent Architecture of Light)
- **UX Pattern:** Horizontal scrolling containers.
- **Card Design:** Large image area with metadata overlay or adjacent technical details (Exposure, ISO, Lens).
- **Pagination:** Minimalist progress bar (solid line for active, faint lines for inactive).

### Footer
- **Structure:** Horizontal layout for desktop.
- **Style:** `border-t border-outline-variant`.
- **Content:** Brand name on the left, social/language icons on the right, and utility links (Journal, Privacy, etc.) centered or distributed.

## Layout & Spacing
- **Container Max-Width:** 1280px (7xl).
- **Horizontal Padding:** `px-margin-desktop` (typically 48px - 80px).
- **Vertical Spacing:** Generous section gaps (`py-24` to `py-32`) to maintain a premium, uncluttered feel.
- **Grids:** Responsive 12-column grid system with 24px - 32px gutters.

## Interaction Design
- **Buttons:** Sharp corners (Round Four preset but often appearing as square for editorial feel). Transitions are 300ms ease-in-out.
- **Links:** Subtle opacity change on hover (80%) or color shift to primary black.
- **Images:** "Zero Compression" visual treatment, crisp, high-resolution with no visible artifacts.
