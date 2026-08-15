/**
 * The inline SVG icons used across the app.
 *
 * They are defined here rather than pasted into JSX so that markup reads as
 * intent ("a lock") instead of path data, and so a shape only has to be fixed
 * in one place. Each icon draws with `currentColor`, so callers set the colour
 * through normal CSS `color` inheritance.
 */
import type { CSSProperties, ReactNode } from 'react';

interface IconProps {
    /** Rendered width and height in px. */
    size?: number;
    style?: CSSProperties;
}

interface BaseIconProps extends IconProps {
    children: ReactNode;
    strokeWidth?: number;
    viewBox?: string;
    /** Defaults match SVG's own defaults so shapes stay pixel-identical. */
    strokeLinecap?: 'butt' | 'round' | 'square';
    strokeLinejoin?: 'miter' | 'round' | 'bevel';
}

/** Shared `<svg>` shell: square, stroked, and hidden from assistive tech. */
function Icon({
    size = 20,
    strokeWidth = 1.5,
    viewBox = '0 0 24 24',
    strokeLinecap = 'round',
    strokeLinejoin = 'round',
    style,
    children,
}: BaseIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
            style={style}
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

/* ------------------------------------------------------------------ */
/* Visibility                                                          */
/* ------------------------------------------------------------------ */

/** Globe — marks a gallery as publicly visible. */
export const GlobeIcon = (props: IconProps & { strokeWidth?: number }) => (
    <Icon {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Icon>
);

/** Padlock — marks a gallery as private. */
export const LockIcon = (props: IconProps & { strokeWidth?: number }) => (
    <Icon {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
);

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Waste bin — destructive actions (delete photo / delete gallery). */
export const TrashIcon = (props: IconProps & { strokeWidth?: number }) => (
    <Icon {...props}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
);

/** Tray with an up arrow — the drag-and-drop upload target. */
export const UploadIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
);

/** Plus — the "add a photo" affordance. Square caps, matching the original. */
export const PlusIcon = (props: IconProps) => (
    <Icon {...props} strokeLinecap="butt" strokeLinejoin="miter">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
);

/** Magnifier — the photographer search field. */
export const SearchIcon = (props: IconProps) => (
    <Icon {...props}>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Icon>
);

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

/** Chevron pointing left — previous slide. */
export const ChevronLeftIcon = (props: IconProps) => (
    <Icon {...props}>
        <polyline points="15 18 9 12 15 6" />
    </Icon>
);

/** Chevron pointing right — next slide. */
export const ChevronRightIcon = (props: IconProps) => (
    <Icon {...props}>
        <polyline points="9 18 15 12 9 6" />
    </Icon>
);

/* ------------------------------------------------------------------ */
/* Identity and theme                                                  */
/* ------------------------------------------------------------------ */

/** Bust silhouette — the signed-in account menu. */
export const UserIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </Icon>
);

/** Sun — switch to light mode. */
export const SunIcon = (props: IconProps) => (
    <Icon {...props}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Icon>
);

/** Crescent moon — switch to dark mode. */
export const MoonIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
);

/* ------------------------------------------------------------------ */
/* Marketing                                                           */
/* ------------------------------------------------------------------ */

/** Monitor showing "HD" — the image-quality feature card. */
export const HDIcon = (props: IconProps) => (
    <Icon {...props}>
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <path d="M7 9v6M11 9v6M7 12h4M14 9h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2V9z" />
    </Icon>
);

/** Two people — the share-your-portfolio feature card. */
export const UsersIcon = (props: IconProps) => (
    <Icon {...props}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
);

/** Discord mark — the community link in the footer. */
export const DiscordIcon = (props: IconProps) => (
    <Icon {...props} viewBox="0 0 48 48">
        <path d="M17.59,34.1733c-.89,1.3069-1.8944,2.6152-2.91,3.8267C7.3,37.79,4.5,33,4.5,33A44.83,44.83,0,0,1,9.31,13.48,16.47,16.47,0,0,1,18.69,10l1,2.31A32.6875,32.6875,0,0,1,24,12a32.9643,32.9643,0,0,1,4.33.3l1-2.31a16.47,16.47,0,0,1,9.38,3.51A44.8292,44.8292,0,0,1,43.5,33s-2.8,4.79-10.18,5a47.4193,47.4193,0,0,1-2.86-3.81m6.46-2.9c-3.84,1.9454-7.5555,3.89-12.92,3.89s-9.08-1.9446-12.92-3.89" />
        <circle cx="17.847" cy="26.23" r="3.35" />
        <circle cx="30.153" cy="26.23" r="3.35" />
    </Icon>
);
