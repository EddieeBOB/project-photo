import * as React from 'react';
import IconButton from '@mui/material/IconButton';

import { colors, typography } from '../../theme';
import { TrashIcon } from '../icons';

/** How long the button stays armed before falling back to its idle label. */
const CONFIRM_WINDOW_MS = 3000;

/**
 * Two-step delete for a whole exhibition: the first click arms the button and
 * turns it red, the second within {@link CONFIRM_WINDOW_MS} actually deletes.
 * Deleting a gallery cannot be undone, so it should not be one stray click away.
 */
export default function DeleteGalleryButton({ onConfirm }: { onConfirm: () => void }) {
    const [armed, setArmed] = React.useState(false);

    React.useEffect(() => {
        if (!armed) return;
        const timer = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
        return () => clearTimeout(timer);
    }, [armed]);

    const handleClick = () => {
        if (armed) {
            onConfirm();
            setArmed(false);
        } else {
            setArmed(true);
        }
    };

    return (
        <IconButton
            onClick={handleClick}
            aria-label={armed ? 'Confirm delete gallery' : 'Delete gallery'}
            sx={{
                backgroundColor: armed ? colors.danger : 'transparent',
                border: `1px solid ${armed ? colors.danger : colors.borderLight}`,
                borderRadius: '0px',
                p: '8px 12px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: typography.ui,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                color: armed ? colors.onPrimary : colors.textSecondary,
                transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
                '&:hover': {
                    backgroundColor: colors.danger,
                    borderColor: colors.danger,
                    color: colors.onPrimary,
                },
            }}
        >
            <TrashIcon size={14} strokeWidth={2} />
            <span>{armed ? 'Confirm Delete?' : 'Delete Gallery'}</span>
        </IconButton>
    );
}
