import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';

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
    transition: 'all 0.3s ease-in-out',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: 'transparent',
        color: colors.primary,
        boxShadow: 'none',
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
    transition: 'all 0.3s ease-in-out',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        boxShadow: 'none',
    }
});
