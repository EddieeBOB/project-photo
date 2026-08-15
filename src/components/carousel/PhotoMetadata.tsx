import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { colors, typography } from '../../theme';

/** The rule-separated shooting-settings column on the right of a photo card. */
export function MetadataGroup({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: { xs: 2, md: 3 },
                borderLeft: `1px solid ${colors.borderLight}`,
                pl: { xs: 2, md: 3 },
            }}
        >
            {children}
        </Box>
    );
}

interface MetadataFieldProps {
    label: string;
    /** Either plain text (read-only carousel) or an input (studio editor). */
    children: ReactNode;
}

/** One labelled setting — exposure, ISO, or lens. */
export function MetadataField({ label, children }: MetadataFieldProps) {
    return (
        <Box>
            <Typography
                sx={{
                    fontFamily: typography.ui,
                    fontSize: '10px',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    mb: 0.5,
                }}
            >
                {label}
            </Typography>
            <Box
                sx={{
                    fontFamily: typography.ui,
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.text,
                    // Keeps numbers from jittering as values change.
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
