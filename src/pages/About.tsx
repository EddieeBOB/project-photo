import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

import { colors, typography } from '../theme';

export default function About() {
    return (
        <Box sx={{ pt: { xs: 8, md: 12 }, backgroundColor: colors.surfaceBright }}>
            {/* Hero Section */}
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: '60vh',
                    minHeight: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: colors.surfaceLow,
                }}
            >
                <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, position: 'relative', zIndex: 2, textAlign: 'center' }}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '36px', md: '56px' },
                            fontWeight: 400,
                            color: colors.text,
                            mb: 3,
                            lineHeight: 1.2,
                        }}
                    >
                        A Home for the Dedicated Lens.
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            fontFamily: typography.ui,
                            fontSize: { xs: '16px', md: '18px' },
                            color: colors.textSecondary,
                            maxWidth: '720px',
                            mx: 'auto',
                            lineHeight: 1.6,
                        }}
                    >
                        We believe in the power of intentional curation. Frame Collective is a sanctuary for visual craft, where every image is given the space to speak.
                    </Typography>
                </Container>
            </Box>

            {/* Mission Section */}
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 8, md: 12 } }}>
                <Grid container spacing={{ xs: 4, md: 6 }}>
                    <Grid size={{ xs: 12, md: 5 }} sx={{ borderTop: `1px solid ${colors.borderLight}`, pt: 3 }}>
                        <Typography
                            variant="h2"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '28px', md: '36px' },
                                fontWeight: 400,
                                color: colors.text,
                                mb: 2,
                            }}
                        >
                            Democratizing the Art of Seeing
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 7 }} sx={{ borderTop: `1px solid ${colors.borderLight}`, pt: 3 }}>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '16px',
                                color: colors.textSecondary,
                                lineHeight: 1.7,
                                mb: 3,
                            }}
                        >
                            Our mission extends beyond simply hosting images. We aim to foster a community defined not by exclusivity, but by an unwavering commitment to quality and craft. In an era of endless scrolling, we champion the deliberate act of looking.
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '16px',
                                color: colors.textSecondary,
                                lineHeight: 1.7,
                            }}
                        >
                            By providing an editorial-grade platform, we empower photographers to present their work with the fidelity it deserves, elevating the discourse around contemporary photography.
                        </Typography>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
