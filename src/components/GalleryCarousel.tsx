import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';

import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';
import type { CarouselPhoto, GalleryWithPhotos } from '../types/gallery';
import { DEMO_GALLERY_ID, demoGallery } from '../data/demoGallery';
import { useCarouselScroll } from '../hooks/useCarouselScroll';
import CarouselArrow from './carousel/CarouselArrow';
import ProgressDots from './carousel/ProgressDots';
import VisibilityToggle from './carousel/VisibilityToggle';
import DeleteGalleryButton from './carousel/DeleteGalleryButton';
import { MetadataField, MetadataGroup } from './carousel/PhotoMetadata';
import PhotoImage from './PhotoImage';
import { TrashIcon } from './icons';

export interface GalleryCarouselProps {
    gallery?: GalleryWithPhotos;
    authorName?: string;
    /** Position within a list of exhibitions; drives the "EXHIBITION NO." label. */
    index?: number;
    /** Owner-only actions. Omitting one hides its control. */
    onDelete?: (galleryId: string) => void;
    onTogglePublic?: (galleryId: string, isPublic: boolean) => void;
    onDeletePhoto?: (galleryId: string, photoId: string) => void;
    /** Set on the first carousel of a page that already has its own heading. */
    disableHeaderPadding?: boolean;
}

/**
 * Exhibitions are numbered by their position on the page ("01", "02", …).
 * A carousel rendered on its own has no position, so it falls back to the
 * gallery id — or, for the demo deck, a stand-in number.
 */
function exhibitionNumber(index: number | undefined, galleryId: string): string {
    if (index !== undefined) return String(index + 1).padStart(2, '0');
    return galleryId === DEMO_GALLERY_ID ? '12' : galleryId;
}

/** One photograph: the image, its caption, and the settings it was shot at. */
function PhotoCard({
    photo,
    authorName,
    onDelete,
}: {
    photo: CarouselPhoto;
    authorName: string;
    onDelete?: () => void;
}) {
    const { t } = useTranslation();

    return (
        <Box
            sx={{
                minWidth: { xs: '100%', md: '85%' },
                scrollSnapAlign: 'center',
                border: `1px solid ${colors.borderLight}`,
                backgroundColor: colors.onPrimary,
                p: { xs: 2, md: 3 },
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box sx={{ width: '100%', aspectRatio: { xs: '4/3', md: '16/9' }, backgroundColor: '#F3F3F3', mb: 3, position: 'relative' }}>
                <PhotoImage
                    src={photo.src}
                    alt={photo.title || 'Untitled photograph'}
                    thumbhash={photo.thumbhash}
                    loading="lazy"
                    width={1200}
                    height={675}
                />
                {onDelete && (
                    <IconButton
                        onClick={onDelete}
                        aria-label="Delete photo"
                        sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            backgroundColor: colors.surfaceBright,
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: '0px',
                            color: colors.textSecondary,
                            '&:hover': {
                                backgroundColor: colors.danger,
                                borderColor: colors.danger,
                                color: colors.onPrimary,
                            },
                            transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                            p: 1,
                        }}
                    >
                        <TrashIcon size={14} strokeWidth={2} />
                    </IconButton>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                    <Typography sx={{ fontFamily: typography.headline, fontSize: { xs: '20px', md: '24px' }, color: colors.text, mb: 0.5 }}>
                        {photo.title}
                    </Typography>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic' }}>
                        {t('galleryCarousel.by')}{authorName}
                    </Typography>
                </Box>

                <MetadataGroup>
                    <MetadataField label={t('galleryCarousel.exposure')}>{photo.metadata?.exposure || 'N/A'}</MetadataField>
                    <MetadataField label={t('galleryCarousel.iso')}>{photo.metadata?.iso || 'N/A'}</MetadataField>
                    <MetadataField label={t('galleryCarousel.lens')}>{photo.metadata?.lens || 'N/A'}</MetadataField>
                </MetadataGroup>
            </Box>
        </Box>
    );
}

/**
 * Read-only exhibition viewer: a horizontally snapping deck of photo cards.
 *
 * Passing any of the `on*` callbacks turns on the matching owner control, which
 * is how the studio reuses this component to manage published work. The demo
 * gallery never shows them.
 */
export default function GalleryCarousel({
    gallery = demoGallery,
    authorName = 'Frame Artist',
    index,
    onDelete,
    onTogglePublic,
    onDeletePhoto,
    disableHeaderPadding,
}: GalleryCarouselProps) {
    const { t } = useTranslation();
    const { scrollRef, activeIndex, goPrev, goNext, onScroll } = useCarouselScroll();

    // The editor's trailing "add a photo" tile has no place in a read-only deck.
    const photos = gallery.photos.filter((photo) => !photo.isNew);
    const isEditable = gallery.id !== DEMO_GALLERY_ID;

    return (
        <Box
            sx={{
                pt: disableHeaderPadding
                    ? { xs: 2, md: 2 }
                    : (index !== undefined && index > 0 ? { xs: 4, md: 6 } : { xs: 12, md: 12 }),
                pb: { xs: 2, md: 0 },
                backgroundColor: colors.surface,
            }}
        >
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
                                mb: 1,
                            }}
                        >
                            {t('galleryCarousel.exhibitionNo')}{exhibitionNumber(index, gallery.id)}
                        </Typography>
                        <Typography
                            variant="h2"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '36px', md: '48px' },
                                fontWeight: 400,
                                color: colors.text,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            {gallery.title || 'Untitled Exhibition'}
                        </Typography>
                    </Box>

                    {/* Owner controls */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {onTogglePublic && isEditable && (
                            <VisibilityToggle
                                isPublic={Boolean(gallery.isPublic)}
                                onToggle={() => onTogglePublic(gallery.id, !gallery.isPublic)}
                            />
                        )}
                        {onDelete && isEditable && (
                            <DeleteGalleryButton onConfirm={() => onDelete(gallery.id)} />
                        )}
                    </Box>
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <CarouselArrow direction="prev" onClick={goPrev} disabled={activeIndex === 0} />
                    <CarouselArrow direction="next" onClick={goNext} disabled={activeIndex === photos.length - 1} />

                    <Box
                        ref={scrollRef}
                        onScroll={onScroll}
                        sx={{
                            display: 'flex',
                            overflowX: 'auto',
                            overscrollBehaviorX: 'contain',
                            touchAction: 'pan-x',
                            scrollSnapType: 'x mandatory',
                            scrollbarWidth: 'none',
                            '&::-webkit-scrollbar': { display: 'none' },
                            gap: 4,
                            pb: 2,
                            // Spacers so the first and last cards can still centre.
                            '&::before': {
                                content: '""',
                                flex: '0 0 auto',
                                width: { xs: 0, md: 'calc(7.5% - 32px)' },
                            },
                            '&::after': {
                                content: '""',
                                flex: '0 0 auto',
                                width: { xs: 0, md: 'calc(7.5% - 32px)' },
                            },
                        }}
                    >
                        {photos.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                authorName={authorName}
                                onDelete={onDeletePhoto && (() => onDeletePhoto(gallery.id, photo.id))}
                            />
                        ))}
                    </Box>
                </Box>

                <ProgressDots count={photos.length} activeIndex={activeIndex} />

            </Container>
        </Box>
    );
}
