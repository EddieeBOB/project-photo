import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

// Minimalist icons using SVG paths
const CameraIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const LayersIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
    </svg>
);

const ApertureIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="12" cy="12" r="10" />
        <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
        <line x1="9.69" y1="8" x2="21.17" y2="8" />
        <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
        <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
        <line x1="14.31" y1="16" x2="2.83" y2="16" />
        <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
    </svg>
);

const colors = {
    text: '#1A1C1E',
    textSecondary: '#44474E',
    borderLight: 'rgba(0, 0, 0, 0.1)',
};

const typography = {
    headline: '"Playfair Display", serif',
    ui: '"Inter", sans-serif',
};

const CardContainer = styled(Box)({
    border: `1px solid ${colors.borderLight}`,
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    backgroundColor: '#FFFFFF', // Surface Bright
    '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 24px rgba(0,0,0,0.04)',
    }
});

const features = [
    {
        icon: <CameraIcon />,
        title: "Zero Compression",
        description: "Your photography, untouched. We display your work in its original, high-fidelity format without destructive compression algorithms."
    },
    {
        icon: <ApertureIcon />,
        title: "Editorial Presentation",
        description: "Designed like a high-end print magazine. Generous whitespace and strict typography let your imagery command full attention."
    },
    {
        icon: <LayersIcon />,
        title: "Technical Metadata",
        description: "Automatically extract and beautifully present your EXIF data. Let viewers appreciate the craft behind the capture."
    }
];

export default function FeatureCards() {
    return (
        <Box sx={{ py: { xs: 8, md: 16 }, backgroundColor: '#F3F3F3' /* Surface Container Low */ }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                <Grid container spacing={{ xs: 4, md: 6 }}>
                    {features.map((feature, index) => (
                        <Grid size={{ xs: 12, md: 4 }} key={index}>
                            <CardContainer>
                                <Box sx={{ mb: 4, color: colors.text }}>
                                    {feature.icon}
                                </Box>
                                <Typography
                                    variant="h3"
                                    sx={{
                                        fontFamily: typography.headline,
                                        fontSize: '24px', // Headline Small
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
