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
                    height: '80vh',
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
                        I believe in the power of intentional curation. Sites like, Instagram, have made it easy to share photos, but they have also made it easy to get lost in the noise. Frame is a place for photographers to showcase their work without distractions, and for viewers to appreciate photography without the clutter of social media.
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}
