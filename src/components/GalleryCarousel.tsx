import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';

const colors = {
    text: '#1A1C1E',
    textSecondary: '#44474E',
    borderLight: 'rgba(0, 0, 0, 0.1)',
};

const typography = {
    headline: '"Playfair Display", serif',
    ui: '"Inter", sans-serif',
};

const images = [
    {
        id: 1,
        src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'SILENT GEOMETRY',
        metadata: {
            lens: '50mm f/1.4',
            iso: '100',
            shutter: '1/250s'
        }
    },
    {
        id: 2,
        src: 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'URBAN TEXTURE',
        metadata: {
            lens: '35mm f/2.0',
            iso: '400',
            shutter: '1/125s'
        }
    },
    {
        id: 3,
        src: 'https://images.unsplash.com/photo-1506744626753-1fa30fd200ab?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'NATURE RESERVED',
        metadata: {
            lens: '85mm f/1.8',
            iso: '200',
            shutter: '1/500s'
        }
    }
];

const ProgressBar = styled(Box)(({ active }: { active: boolean }) => ({
    height: '2px',
    flex: 1,
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
            const newIndex = Math.round(scrollPosition / itemWidth);
            setActiveIndex(newIndex);
        }
    };

    const scrollToIndex = (index: number) => {
        if (scrollRef.current) {
            const itemWidth = scrollRef.current.clientWidth;
            scrollRef.current.scrollTo({
                left: index * itemWidth,
                behavior: 'smooth'
            });
            setActiveIndex(index);
        }
    };

    return (
        <Box sx={{ py: { xs: 8, md: 16 } }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <Typography 
                        variant="h2" 
                        sx={{ 
                            fontFamily: typography.headline,
                            fontSize: { xs: '32px', md: '40px' }, // Headline Medium
                            fontWeight: 400,
                            color: colors.text,
                        }}
                    >
                        Exhibition No. 12
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <IconButton 
                            onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
                            disabled={activeIndex === 0}
                            sx={{ border: `1px solid ${colors.borderLight}`, borderRadius: '0px' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </IconButton>
                        <IconButton 
                            onClick={() => scrollToIndex(Math.min(images.length - 1, activeIndex + 1))}
                            disabled={activeIndex === images.length - 1}
                            sx={{ border: `1px solid ${colors.borderLight}`, borderRadius: '0px' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </IconButton>
                    </Box>
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
                        mb: 6
                    }}
                >
                    {images.map((image) => (
                        <Box 
                            key={image.id}
                            sx={{ 
                                minWidth: '100%',
                                scrollSnapAlign: 'start',
                                pr: { md: 4 } // Small gap if needed
                            }}
                        >
                            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#F3F3F3' }}>
                                <img 
                                    src={image.src} 
                                    alt={image.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                
                                {/* Overlay Metadata */}
                                <Box sx={{ 
                                    position: 'absolute', 
                                    bottom: 0, 
                                    left: 0, 
                                    right: 0, 
                                    p: 4,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-end',
                                    color: '#ffffff'
                                }}>
                                    <Typography 
                                        sx={{ 
                                            fontFamily: typography.ui, 
                                            fontSize: '14px', 
                                            fontWeight: 600, 
                                            letterSpacing: '0.1em' 
                                        }}
                                    >
                                        {image.title}
                                    </Typography>
                                    
                                    <Box sx={{ display: 'flex', gap: 3 }}>
                                        {Object.entries(image.metadata).map(([key, value]) => (
                                            <Box key={key} sx={{ textAlign: 'center' }}>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{key}</Typography>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 500 }}>{value}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    ))}
                </Box>

                {/* Minimalist Progress Bar */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {images.map((_, index) => (
                        <ProgressBar key={index} active={index === activeIndex} />
                    ))}
                </Box>
            </Container>
        </Box>
    );
}
