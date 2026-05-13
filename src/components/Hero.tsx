import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const colors = {
    primary: '#000000',
    onPrimary: '#ffffff',
    text: '#1A1C1E',
    textSecondary: '#44474E',
    borderLight: 'rgba(0, 0, 0, 0.1)',
};

const typography = {
    headline: '"Playfair Display", serif',
    ui: '"Inter", sans-serif',
};

const PrimaryButton = styled(Button)({
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

const SecondaryButton = styled(Button)({
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

const HeroTitle = [{ title: "Frame.", subtitle: "A Home for Every Lens." }]

export default function Hero() {
    return (
        <Box sx={{ pt: { xs: 16, md: 24 }, pb: { xs: 8, md: 16 } }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: 'center',
                        gap: { xs: 6, md: 12 }
                    }}
                >
                    {/* Left side: Text Content */}
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            variant="h1"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '48px', md: '64px' },
                                fontWeight: 300,
                                color: colors.text,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.1,
                                mb: 3
                            }}
                        >
                            {HeroTitle[0].title} <br /> {HeroTitle[0].subtitle}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '18px',
                                color: colors.textSecondary,
                                lineHeight: 1.6,
                                mb: 6,
                                maxWidth: '500px'
                            }}
                        >
                            A platform where photography can exist without the noise. Share your story, one frame at a time.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <PrimaryButton disableRipple>Explore Gallery</PrimaryButton>
                            <SecondaryButton disableRipple>Read the Journal</SecondaryButton>
                        </Box>
                    </Box>

                    {/* Right side: Visual */}
                    <Box sx={{ flex: 1, position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <Box
                            sx={{
                                width: '100%',
                                maxWidth: '480px',
                                aspectRatio: '4/5',
                                backgroundColor: colors.borderLight,
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 24px 48px rgba(0,0,0,0.08)',
                                overflow: 'hidden'
                            }}
                        >
                            <img
                                src="/assets/hero.png"
                                alt="Luminous Gallery Interior"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
