import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';

export const colors = {
    primary: '#000000',
    onPrimary: '#ffffff',
    text: '#1A1C1E',
    textSecondary: '#44474E',
    borderLight: 'rgba(0, 0, 0, 0.1)',
    surface: '#F9F9F9',
    surfaceTransparent: 'rgba(249, 249, 249, 0.8)',
    surfaceBright: '#FFFFFF',
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
