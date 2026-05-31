import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

// Globe icon
const GlobeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

// HD icon
const HDIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <path d="M7 9v6M11 9v6M7 12h4M14 9h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2V9z" />
    </svg>
);

// Users icon
const UsersIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

import { colors, typography } from '../theme';

const CardContainer = styled(Box)({
    border: `1px solid ${colors.borderLight}`,
    padding: '40px 32px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: colors.surfaceBright,
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 24px rgba(0,0,0,0.02)',
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
        title: "Open Ecosystem",
        description: "No invite codes or exclusive waitlists. If you have a story to tell through your lens, you belong here."
    },
    {
        icon: <HDIcon />,
        title: "Zero Compression",
        description: "We treat your work with respect. High-resolution storage ensures your pixels stay exactly as you intended."
    },
    {
        icon: <UsersIcon />,
        title: "Inclusive Dialogue",
        description: "Connect with peers through meaningful critique and collaborative collections in a safe, moderated space."
    }
];

export default function FeatureCards() {
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
                    <Box sx={{ maxWidth: '720px' }}>
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
                            Democratizing the Art of Seeing
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
                            We believe photography shouldn't be gated. Frame provides professional-grade tools and presentation for everyone—from the smartphone enthusiast to the seasoned professional.
                        </Typography>
                    </Box>
                </Box>

                {/* Cards Section */}
                <Grid container spacing={{ xs: 4, md: 4 }}>
                    {features.map((feature, index) => (
                        <Grid size={{ xs: 12, md: 4 }} key={index}>
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
                            </CardContainer>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
