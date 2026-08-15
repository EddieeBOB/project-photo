import IconButton from '@mui/material/IconButton';

import { colors, typography } from '../../theme';
import { GlobeIcon, LockIcon } from '../icons';

interface VisibilityToggleProps {
    isPublic: boolean;
    onToggle: () => void;
    disabled?: boolean;
    /** `medium` gives the studio editor a slightly larger hit area. */
    size?: 'small' | 'medium';
}

/**
 * Public/private switch for a gallery, rendered as a labelled button.
 *
 * Its pressed state carries the meaning, so it exposes `aria-pressed` rather
 * than relying on the visible label alone.
 */
export default function VisibilityToggle({
    isPublic,
    onToggle,
    disabled = false,
    size = 'small',
}: VisibilityToggleProps) {
    return (
        <IconButton
            onClick={onToggle}
            disabled={disabled}
            aria-label={isPublic ? 'Make gallery private' : 'Make gallery public'}
            aria-pressed={isPublic}
            sx={{
                border: `1px solid ${isPublic ? colors.text : colors.borderLight}`,
                borderRadius: '0px',
                p: size === 'medium' ? '10px 14px' : '8px 12px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: typography.ui,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                color: isPublic ? colors.text : colors.textSecondary,
                transition: 'border-color 0.3s ease, color 0.3s ease, background-color 0.3s ease',
                '&:hover': {
                    borderColor: colors.text,
                    color: colors.text,
                    backgroundColor: colors.hoverOverlaySubtle,
                },
            }}
        >
            {isPublic ? <GlobeIcon size={14} strokeWidth={2} /> : <LockIcon size={14} strokeWidth={2} />}
            <span>{isPublic ? 'Public' : 'Private'}</span>
        </IconButton>
    );
}
