import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

import { colors, typography } from '../theme';

const carouselItems = [
    {
        id: 1,
        src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Void and Structure',
        author: 'Julian Vossen',
        metadata: {
            exposure: '1/125 · f/8.0',
            iso: '100',
            lens: '35mm'
        }
    },
    {
        id: 2,
        src: 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Organic Tension',
        author: 'Elena Rossi',
        metadata: {
            exposure: '1/250 · f/5.6',
            iso: '400',
            lens: '50mm'
        }
    },
    {
        id: 3,
        src: 'https://images.unsplash.com/photo-1506744626753-1fa30fd200ab?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Silent Geometry',
        author: 'Marcus Lin',
        metadata: {
            exposure: '1/500 · f/2.8',
            iso: '100',
            lens: '85mm'
        }
    }
];

const ProgressBar = styled(Box)(({ active }: { active: boolean }) => ({
    height: '1px',
    width: '40px',
    backgroundColor: active ? colors.text : colors.borderLight,
    transition: 'background-color 0.3s ease',
}));

export default function GalleryCarousel() {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollPosition = scrollRef.current.scrollLeft;
            const itemWidth = scrollRef.current.clientWidth;
            // Add a small threshold so it doesn't jump too eagerly
            const newIndex = Math.round(scrollPosition / itemWidth);
            setActiveIndex(newIndex);
        }
    };

    return (
        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#F9F9F9' }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>

                {/* Header */}
                <Box sx={{ mb: 6, mt: 5 }}>
                    <Typography
                        sx={{
                            fontFamily: typography.ui,
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            color: colors.textSecondary,
                            textTransform: 'uppercase',
                            mb: 1
                        }}
                    >
                        EXHIBITION NO. 12
                    </Typography>
                    <Typography
                        variant="h2"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '36px', md: '48px' },
                            fontWeight: 400,
                            color: colors.text,
                            letterSpacing: '-0.02em'
                        }}
                    >
                        The Silent Architecture of Light
                    </Typography>
                </Box>

                {/* Carousel Container */}
                <Box
                    ref={scrollRef}
                    onScroll={handleScroll}
                    sx={{
                        display: 'flex',
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                        gap: 4,
                        pb: 2
                    }}
                >
                    {carouselItems.map((item) => (
                        <Box
                            key={item.id}
                            sx={{
                                minWidth: { xs: '100%', md: '85%' },
                                scrollSnapAlign: 'center',
                                border: `1px solid ${colors.borderLight}`,
                                backgroundColor: colors.onPrimary,
                                p: { xs: 2, md: 3 },
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Image */}
                            <Box sx={{ width: '100%', aspectRatio: { xs: '4/3', md: '16/9' }, backgroundColor: '#F3F3F3', mb: 3 }}>
                                <img
                                    src={item.src}
                                    alt={item.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </Box>

                            {/* Footer of Card */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 3 }}>
                                <Box>
                                    <Typography
                                        sx={{
                                            fontFamily: typography.headline,
                                            fontSize: { xs: '20px', md: '24px' },
                                            color: colors.text,
                                            mb: 0.5
                                        }}
                                    >
                                        {item.title}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontFamily: typography.ui,
                                            fontSize: '14px',
                                            color: colors.textSecondary,
                                            fontStyle: 'italic'
                                        }}
                                    >
                                        by {item.author}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, borderLeft: `1px solid ${colors.borderLight}`, pl: { xs: 2, md: 3 } }}>
                                    <Box>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Exposure</Typography>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata.exposure}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>ISO</Typography>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata.iso}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Lens</Typography>
                                        <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata.lens}</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    ))}
                </Box>

                {/* Dots */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
                    {carouselItems.map((_, index) => (
                        <ProgressBar key={index} active={index === activeIndex} />
                    ))}
                </Box>

            </Container>
        </Box>
    );
}
