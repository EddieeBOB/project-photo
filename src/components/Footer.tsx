import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

const colors = {
    text: '#1A1C1E',
    textSecondary: '#44474E',
    borderLight: 'rgba(0, 0, 0, 0.1)',
};

const typography = {
    headline: '"Playfair Display", serif',
    ui: '"Inter", sans-serif',
};

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
        href="#"
        sx={{ 
            color: colors.textSecondary, 
            display: 'flex', 
            transition: 'color 0.2s ease',
            '&:hover': { color: colors.text } 
        }}
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
    </Box>
);

export default function Footer() {
    return (
        <Box sx={{ borderTop: `1px solid ${colors.borderLight}`, backgroundColor: '#F9F9F9', py: 6 }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                <Box 
                    sx={{ 
                        display: 'flex', 
                        flexDirection: { xs: 'column', md: 'row' }, 
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', md: 'center' },
                        gap: 4
                    }}
                >
                    {/* Brand */}
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            fontFamily: typography.headline,
                            color: colors.text,
                            fontSize: '20px',
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase'
                        }}
                    >
                        Frame
                    </Typography>

                    {/* Utility Links */}
                    <Box sx={{ display: 'flex', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
                        <FooterLink href="#">Journal</FooterLink>
                        <FooterLink href="#">Exhibitions</FooterLink>
                        <FooterLink href="#">Artists</FooterLink>
                        <FooterLink href="#">Privacy</FooterLink>
                        <FooterLink href="#">Terms</FooterLink>
                    </Box>

                    {/* Socials / Language */}
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', color: colors.textSecondary }}>EN</Typography>
                        <SocialIcon />
                    </Box>
                </Box>
                
                <Box sx={{ mt: 6, pt: 4, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '11px', color: colors.textSecondary }}>
                        © {new Date().getFullYear()} Frame Collective. All rights reserved.
                    </Typography>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '11px', color: colors.textSecondary }}>
                        Luminous Editorial Design System
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}
