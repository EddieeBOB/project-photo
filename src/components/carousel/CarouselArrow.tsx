import IconButton from '@mui/material/IconButton';

import { colors } from '../../theme';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

interface CarouselArrowProps {
    direction: 'prev' | 'next';
    onClick: () => void;
    /** At either end of the deck the arrow fades out and stops taking clicks. */
    disabled: boolean;
}

/** Floating previous/next control, pinned to the edge of a carousel. */
export default function CarouselArrow({ direction, onClick, disabled }: CarouselArrowProps) {
    const isPrev = direction === 'prev';

    return (
        <IconButton
            onClick={onClick}
            disabled={disabled}
            aria-label={isPrev ? 'Previous photo' : 'Next photo'}
            sx={{
                position: 'absolute',
                // Sits just outside the deck on desktop, inset over it on mobile.
                ...(isPrev
                    ? { left: { xs: '8px', md: '-24px' } }
                    : { right: { xs: '8px', md: '-24px' } }),
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                backgroundColor: colors.surfaceBright,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${colors.borderLight}`,
                borderRadius: '0px',
                p: 1.5,
                color: colors.text,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
                '&:hover': {
                    backgroundColor: colors.text,
                    color: colors.onPrimary,
                    borderColor: colors.text,
                },
                '&.Mui-disabled': {
                    opacity: 0,
                    pointerEvents: 'none',
                },
            }}
        >
            {isPrev ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
    );
}
