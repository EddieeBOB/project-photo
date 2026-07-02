import { useState } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Dialog from '@mui/material/Dialog';
import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';
import PrivacyPolicy from './PrivacyPolicy';

const FooterLink = styled(Link)({
    color: colors.textSecondary,
    fontFamily: typography.ui,
    fontSize: '12px',
    textDecoration: 'none',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    transition: 'color 0.2s ease',
    '&:hover': {
        color: colors.text,
    }
});

const SocialIcon = () => (
    <Box
        component="a"
        href="https://discord.gg/MbfDPNSkJg"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit our Discord server"
        sx={{
            color: colors.textSecondary,
            display: 'flex',
            transition: 'color 0.2s ease',
            '&:hover': { color: colors.text }
        }}
    >
        <svg
            width="30"
            height="30"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M17.59,34.1733c-.89,1.3069-1.8944,2.6152-2.91,3.8267C7.3,37.79,4.5,33,4.5,33A44.83,44.83,0,0,1,9.31,13.48,16.47,16.47,0,0,1,18.69,10l1,2.31A32.6875,32.6875,0,0,1,24,12a32.9643,32.9643,0,0,1,4.33.3l1-2.31a16.47,16.47,0,0,1,9.38,3.51A44.8292,44.8292,0,0,1,43.5,33s-2.8,4.79-10.18,5a47.4193,47.4193,0,0,1-2.86-3.81m6.46-2.9c-3.84,1.9454-7.5555,3.89-12.92,3.89s-9.08-1.9446-12.92-3.89" />
            <circle cx="17.847" cy="26.23" r="3.35" />
            <circle cx="30.153" cy="26.23" r="3.35" />
        </svg>
    </Box>
);

export default function Footer() {
    const { t } = useTranslation();
    const [privacyOpen, setPrivacyOpen] = useState(false);

    return (
        <Box sx={{ borderTop: `1px solid ${colors.borderLight}`, backgroundColor: colors.surface, py: 3 }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 1 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', md: 'center' },
                        gap: 4
                    }}
                >
                    {/* Brand — rendered as a span (not a heading) to avoid breaking the
                        page's heading order; it's decorative branding, not a section title. */}
                    <Typography
                        variant="h6"
                        component="span"
                        sx={{
                            fontFamily: typography.headline,
                            color: colors.text,
                            fontSize: '20px',
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase'
                        }}
                    >
                        {t('footer.frame')}
                    </Typography>

                    {/* Utility Links */}
                    <Box sx={{ display: 'flex', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
                        <FooterLink {...({ component: 'button', type: 'button' } as object)} onClick={() => setPrivacyOpen(true)} sx={{ cursor: 'pointer', background: 'none', border: 'none', p: 0 }}>{t('footer.privacy')}</FooterLink>
                    </Box>

                    {/* Socials / Language */}
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', color: colors.textSecondary }}>EN</Typography>
                        <SocialIcon />
                    </Box>
                </Box>

                <Box sx={{ mt: 3, pt: 4, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '11px', color: colors.textSecondary }}>
                        © {new Date().getFullYear()} Frame Collective. All rights reserved.
                    </Typography>
                </Box>
            </Container>

            <Dialog
                open={privacyOpen}
                onClose={() => setPrivacyOpen(false)}
                maxWidth="md"
                fullWidth
                scroll="paper"
                sx={{
                    '& .MuiDialog-paper': {
                        borderRadius: '0px',
                        border: `1px solid ${colors.borderLight}`,
                        backgroundColor: colors.surfaceBright,
                    }
                }}
            >
                <PrivacyPolicy onClose={() => setPrivacyOpen(false)} />
            </Dialog>
        </Box>
    );
}