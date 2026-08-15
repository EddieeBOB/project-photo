import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { colors, typography } from '../../theme';
import { UploadIcon } from '../icons';

/**
 * Full-bleed invitation shown while files are being dragged over the studio.
 *
 * It is `pointerEvents: 'none'` so it can't swallow the drop it is advertising,
 * and both animations are opt-in for anyone who hasn't asked for reduced motion.
 */
export default function DropOverlay() {
    const { t } = useTranslation();

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.scrim,
                backdropFilter: 'blur(12px)',
                border: `2px dashed ${colors.text}`,
                borderRadius: '0px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                pointerEvents: 'none',
                '@media (prefers-reduced-motion: no-preference)': {
                    animation: 'fadeIn 0.2s ease-in-out',
                },
                '@keyframes fadeIn': {
                    '0%': { opacity: 0 },
                    '100%': { opacity: 1 },
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 4,
                    transform: 'scale(1)',
                    transformOrigin: 'center',
                    '@media (prefers-reduced-motion: no-preference)': {
                        animation: 'pulseScale 1.5s infinite ease-in-out',
                    },
                    '@keyframes pulseScale': {
                        '0%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.05)' },
                        '100%': { transform: 'scale(1)' },
                    },
                }}
            >
                <UploadIcon size={48} style={{ color: colors.text, marginBottom: '20px' }} />
                <Typography
                    sx={{
                        fontFamily: typography.headline,
                        fontSize: '24px',
                        fontWeight: 400,
                        color: colors.text,
                        mb: 1,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {t('editableGallery.dropPhotos')}
                </Typography>
                <Typography
                    sx={{
                        fontFamily: typography.ui,
                        fontSize: '14px',
                        color: colors.textSecondary,
                        letterSpacing: '0.02em',
                    }}
                >
                    {t('editableGallery.releaseToAdd')}
                </Typography>
            </Box>
        </Box>
    );
}
