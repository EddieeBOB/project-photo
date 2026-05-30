import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';

import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';
import type { Gallery, CarouselPhoto } from './EditableGalleryCarousel';

export interface GalleryCarouselProps {
    gallery?: Gallery & { photos: CarouselPhoto[]; isPublic?: boolean };
    authorName?: string;
    index?: number;
    onDelete?: (galleryId: string) => void;
    onTogglePublic?: (galleryId: string, isPublic: boolean) => void;
    disableHeaderPadding?: boolean;
}

export const defaultGallery: Gallery & { photos: CarouselPhoto[] } = {
    id: 'default',
    title: 'The Silent Architecture of Light',
    userId: 'system',
    photos: [
        {
            id: '1',
            title: 'Void and Structure',
            description: '',
            src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/125 · f/8.0', iso: '100', lens: '35mm' }
        },
        {
            id: '2',
            title: 'Organic Tension',
            description: '',
            src: 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/250 · f/5.6', iso: '400', lens: '50mm' }
        },
        {
            id: '3',
            title: 'Silent Geometry',
            description: '',
            src: 'https://images.unsplash.com/photo-1506744626753-1fa30fd200ab?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/500 · f/2.8', iso: '100', lens: '85mm' }
        }
    ]
};

const ProgressBar = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ active }) => ({
    height: '1px',
    width: '40px',
    backgroundColor: active ? colors.text : colors.borderLight,
    transition: 'background-color 0.3s ease',
}));

export default function GalleryCarousel({ gallery = defaultGallery, authorName = 'Julian Vossen', index, onDelete, onTogglePublic, disableHeaderPadding }: GalleryCarouselProps) {
    const { t } = useTranslation();
    const [activeIndex, setActiveIndex] = React.useState(0);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    React.useEffect(() => {
        if (confirmDelete) {
            const timer = setTimeout(() => setConfirmDelete(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmDelete]);

    const displayItems = (gallery.photos as CarouselPhoto[]).filter(photo => !photo.isNew);

    const handlePrev = () => {
        if (scrollRef.current) {
            const children = Array.from(scrollRef.current.children) as HTMLElement[];
            const prevIndex = Math.max(activeIndex - 1, 0);
            const targetChild = children[prevIndex];
            if (targetChild) {
                const targetScrollLeft = targetChild.offsetLeft + targetChild.offsetWidth / 2 - scrollRef.current.clientWidth / 2;
                scrollRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
            }
        }
    };

    const handleNext = () => {
        if (scrollRef.current) {
            const children = Array.from(scrollRef.current.children) as HTMLElement[];
            const nextIndex = Math.min(activeIndex + 1, children.length - 1);
            const targetChild = children[nextIndex];
            if (targetChild) {
                const targetScrollLeft = targetChild.offsetLeft + targetChild.offsetWidth / 2 - scrollRef.current.clientWidth / 2;
                scrollRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
            }
        }
    };

    const scrollRaf = React.useRef<number>(0);

    const handleScroll = React.useCallback(() => {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = requestAnimationFrame(() => {
            if (scrollRef.current) {
                const scrollPosition = scrollRef.current.scrollLeft;
                const containerWidth = scrollRef.current.clientWidth;
                const children = Array.from(scrollRef.current.children) as HTMLElement[];
                if (children.length === 0) return;

                let closestIndex = 0;
                let minDistance = Infinity;

                children.forEach((child, index) => {
                    const childCenter = child.offsetLeft + child.offsetWidth / 2;
                    const viewportCenter = scrollPosition + containerWidth / 2;
                    const distance = Math.abs(childCenter - viewportCenter);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = index;
                    }
                });

                setActiveIndex(closestIndex);
            }
        });
    }, []);

    React.useEffect(() => {
        return () => cancelAnimationFrame(scrollRaf.current);
    }, []);

    return (
        <Box sx={{ 
            pt: disableHeaderPadding 
                ? { xs: 2, md: 2 } 
                : (index !== undefined && index > 0 ? { xs: 4, md: 6 } : { xs: 12, md: 12 }), 
            pb: { xs: 2, md: 0 }, 
            backgroundColor: '#F9F9F9' 
        }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>

                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 0.5, mt: disableHeaderPadding ? 0 : 5, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
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
                            {t('galleryCarousel.exhibitionNo')}{index !== undefined ? String(index + 1).padStart(2, '0') : (gallery.id === 'default' ? '12' : gallery.id)}
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
                            {gallery.title || 'Untitled Exhibition'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {onTogglePublic && gallery.id !== 'default' && (
                            <IconButton
                                onClick={() => onTogglePublic(gallery.id, !gallery.isPublic)}
                                aria-label="toggle gallery visibility"
                                sx={{
                                    border: `1px solid ${gallery.isPublic ? colors.text : colors.borderLight}`,
                                    borderRadius: '0px',
                                    p: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: typography.ui,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    gap: 1.5,
                                    alignItems: 'center',
                                    color: gallery.isPublic ? colors.text : colors.textSecondary,
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        borderColor: colors.text,
                                        color: colors.text,
                                        backgroundColor: 'rgba(0,0,0,0.02)'
                                    }
                                }}
                            >
                                {gallery.isPublic ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="2" y1="12" x2="22" y2="12"></line>
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                        </svg>
                                        <span>Public</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <span>Private</span>
                                    </>
                                )}
                            </IconButton>
                        )}
                        {onDelete && gallery.id !== 'default' && (
                            <IconButton
                                onClick={() => {
                                    if (confirmDelete) {
                                        onDelete(gallery.id);
                                        setConfirmDelete(false);
                                    } else {
                                        setConfirmDelete(true);
                                    }
                                }}
                                aria-label="delete gallery"
                                sx={{
                                    backgroundColor: confirmDelete ? '#ff4d4f' : 'transparent',
                                    border: `1px solid ${confirmDelete ? '#ff4d4f' : colors.borderLight}`,
                                    borderRadius: '0px',
                                    p: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: typography.ui,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    gap: 1,
                                    alignItems: 'center',
                                    color: confirmDelete ? colors.onPrimary : colors.textSecondary,
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        backgroundColor: '#ff4d4f',
                                        borderColor: '#ff4d4f',
                                        color: colors.onPrimary,
                                    }
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Gallery'}</span>
                            </IconButton>
                        )}
                    </Box>
                </Box>

                {/* Carousel Container Wrapper with Relative Position */}
                <Box sx={{ position: 'relative' }}>
                    {/* Previous Button */}
                    <IconButton
                        onClick={handlePrev}
                        disabled={activeIndex === 0}
                        sx={{
                            position: 'absolute',
                            left: { xs: '8px', md: '-24px' },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: '0px',
                            p: 1.5,
                            color: colors.text,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: colors.text,
                                color: colors.onPrimary,
                                borderColor: colors.text,
                            },
                            '&.Mui-disabled': {
                                opacity: 0,
                                pointerEvents: 'none'
                            }
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </IconButton>

                    {/* Next Button */}
                    <IconButton
                        onClick={handleNext}
                        disabled={activeIndex === displayItems.length - 1}
                        sx={{
                            position: 'absolute',
                            right: { xs: '8px', md: '-24px' },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: '0px',
                            p: 1.5,
                            color: colors.text,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                backgroundColor: colors.text,
                                color: colors.onPrimary,
                                borderColor: colors.text,
                            },
                            '&.Mui-disabled': {
                                opacity: 0,
                                pointerEvents: 'none'
                            }
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </IconButton>

                    {/* Carousel Container */}
                    <Box
                        ref={scrollRef}
                        onScroll={handleScroll}
                        sx={{
                            display: 'flex',
                            overflowX: 'auto',
                            overscrollBehaviorX: 'none',
                            scrollSnapType: 'x mandatory',
                            scrollbarWidth: 'none',
                            '&::-webkit-scrollbar': { display: 'none' },
                            gap: 4,
                            pb: 2,
                            '&::before': {
                                content: '""',
                                flex: '0 0 auto',
                                width: { xs: 0, md: 'calc(7.5% - 32px)' }
                            },
                            '&::after': {
                                content: '""',
                                flex: '0 0 auto',
                                width: { xs: 0, md: 'calc(7.5% - 32px)' }
                            }
                        }}
                    >
                        {displayItems.map((item) => (
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
                                        crossOrigin="anonymous"
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
                                            {t('galleryCarousel.by')}{authorName}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, borderLeft: `1px solid ${colors.borderLight}`, pl: { xs: 2, md: 3 } }}>
                                        <Box>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('galleryCarousel.exposure')}</Typography>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata?.exposure || 'N/A'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('galleryCarousel.iso')}</Typography>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata?.iso || 'N/A'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('galleryCarousel.lens')}</Typography>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>{item.metadata?.lens || 'N/A'}</Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Dots */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
                    {displayItems.map((_, index) => (
                        <ProgressBar key={index} active={index === activeIndex} />
                    ))}
                </Box>

            </Container>
        </Box>
    );
}
