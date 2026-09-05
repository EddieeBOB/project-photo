import { useState } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

import { colors, SecondaryButton, typography } from '../theme';
import { GlobeIcon, HDIcon, UsersIcon } from './icons';
import VerifyPhotoDialog from './VerifyPhotoDialog';

/** Lifts on hover, for anyone who hasn't asked for reduced motion. */
const CardContainer = styled(Box)({
    border: `1px solid ${colors.borderLight}`,
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: colors.surfaceBright,
    transformOrigin: 'center',
    '@media (prefers-reduced-motion: no-preference)': {
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.02)',
        }
    }
});

const IconWrapper = styled(Box)({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: colors.surfaceLow,
    color: colors.text,
    marginBottom: '24px',
});

const features = [
    {
        icon: <GlobeIcon />,
        title: 'Signed Photos',
        description: 'All photos are signed with a cryptographic signature that proves they were uploaded by you, and not tampered with.',
        // The only card with an action: a signature is a claim, and a claim
        // nobody can check is just a sentence on a landing page.
        action: 'Verify a photo',
    },
    {
        icon: <HDIcon />,
        title: 'Lossy Compression',
        description: 'All images are balanced between quality and file size so you can showcase your work without compromise.',
    },
    {
        icon: <UsersIcon />,
        title: 'Share your Portfolio',
        description: 'Easily create and share your portfolio with anyone, anywhere.',
    },
];

/** The three-up pitch below the hero on the landing page. */
export default function FeatureCards() {
    const [isVerifyOpen, setIsVerifyOpen] = useState(false);

    return (
        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: colors.surfaceBright }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                {/* Header Section */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', md: 'center' },
                        gap: 4,
                        mb: { xs: 6, md: 8 }
                    }}
                >
                    <Box>
                        <Typography
                            variant="h2"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '32px', md: '40px' },
                                fontWeight: 400,
                                color: colors.text,
                                mb: 2,
                                lineHeight: 1.2
                            }}
                        >
                            A website built for photographers to only see photos.
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: { xs: '15px', md: '16px' },
                                color: colors.textSecondary,
                                lineHeight: 1.6
                            }}
                        >
                            I believe photography is inherently surrounded by noise due to the platforms that we use to share it. Frame strips away all the noise and allows you to focus on what matters most. Photos.
                        </Typography>
                    </Box>
                </Box>

                {/* Cards Section */}
                <Grid container spacing={{ xs: 4, md: 4 }}>
                    {features.map((feature) => (
                        <Grid size={{ xs: 12, md: 4 }} key={feature.title}>
                            <CardContainer>
                                <Box sx={{ display: 'flex' }}>
                                    <IconWrapper>
                                        {feature.icon}
                                    </IconWrapper>
                                </Box>
                                <Typography
                                    variant="h3"
                                    sx={{
                                        fontFamily: typography.headline,
                                        fontSize: '24px',
                                        fontWeight: 400,
                                        color: colors.text,
                                        mb: 2
                                    }}
                                >
                                    {feature.title}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontFamily: typography.ui,
                                        fontSize: '15px',
                                        color: colors.textSecondary,
                                        lineHeight: 1.6,
                                    }}
                                >
                                    {feature.description}
                                </Typography>
                                {feature.action && (
                                    // `mt: auto` pins it to the bottom of the card, so it
                                    // lines up whatever height the descriptions settle at.
                                    <Box sx={{ mt: 'auto', pt: 3 }}>
                                        <SecondaryButton onClick={() => setIsVerifyOpen(true)}>
                                            {feature.action}
                                        </SecondaryButton>
                                    </Box>
                                )}
                            </CardContainer>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <VerifyPhotoDialog open={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} />
        </Box>
    );
}
