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
import { DiscordIcon } from './icons';

const DISCORD_INVITE_URL = 'https://discord.gg/MbfDPNSkJg';

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

/** Link out to the community server. */
const DiscordLink = () => (
    <Box
        component="a"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit our Discord server"
        sx={{
            color: colors.textSecondary,
            display: 'flex',
            transition: 'color 0.2s ease',
            '&:hover': { color: colors.text },
        }}
    >
        <DiscordIcon size={30} />
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
                        <DiscordLink />
                    </Box>
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