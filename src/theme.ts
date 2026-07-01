import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

export const colors = {
    primary: 'var(--primary)',
    onPrimary: 'var(--on-primary)',
    text: 'var(--text)',
    textSecondary: 'var(--text-secondary)',
    borderLight: 'var(--border)',
    surface: 'var(--surface)',
    surfaceTransparent: 'var(--surface-transparent)',
    surfaceBright: 'var(--surface-bright)',
    surfaceLow: 'var(--surface-low)',
    hoverOverlay: 'var(--hover-overlay)',
    hoverOverlaySubtle: 'var(--hover-overlay-subtle)',
    scrim: 'var(--scrim)',
    danger: 'var(--danger, #ff4d4f)',
};

export const typography = {
    headline: '"Playfair Display", serif',
    ui: '"Inter", sans-serif',
};

export const PrimaryButton = styled(Button)({
    borderRadius: '0px',
    fontFamily: typography.ui,
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    padding: '12px 32px',
    border: `1px solid ${colors.primary}`,
    transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: 'transparent',
        color: colors.primary,
        boxShadow: 'none',
    },
    '&:focus-visible': {
        outline: `2px solid ${colors.primary}`,
        outlineOffset: '2px',
    }
});

export const SecondaryButton = styled(Button)({
    borderRadius: '0px',
    fontFamily: typography.ui,
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: colors.text,
    backgroundColor: 'transparent',
    padding: '12px 32px',
    border: `1px solid ${colors.borderLight}`,
    transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: colors.hoverOverlay,
        boxShadow: 'none',
    },
    '&:focus-visible': {
        outline: `2px solid ${colors.text}`,
        outlineOffset: '2px',
    }
});

export const StyledTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
        borderRadius: '0px',
        fontFamily: typography.ui,
        backgroundColor: colors.surfaceBright,
        '& fieldset': {
            borderColor: colors.borderLight,
        },
        '&:hover fieldset': {
            borderColor: colors.textSecondary,
        },
        '&.Mui-focused fieldset': {
            borderColor: colors.primary,
            borderWidth: '1px',
        },
    },
    '& .MuiInputLabel-root': {
        fontFamily: typography.ui,
        color: colors.textSecondary,
        '&.Mui-focused': {
            color: colors.primary,
        }
    }
});
