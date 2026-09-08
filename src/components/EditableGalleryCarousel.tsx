import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';

import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';
import type { CarouselPhoto, Gallery, Photo } from '../types/gallery';
import { createGallery } from '../services/galleryService';
import { processFiles } from '../services/imageProcessing';
import { useAuth } from '../contexts/AuthContext';
import { useCarouselScroll } from '../hooks/useCarouselScroll';
import { useFileDropZone } from '../hooks/useFileDropZone';
import { revokeIfObjectUrl, useRevokeObjectUrls } from '../hooks/useRevokeObjectUrls';
import { createEmptyDraft, unpublishedPhotos, validateDraft } from '../utils/galleryDraft';
import Toast from './Toast';
import CarouselArrow from './carousel/CarouselArrow';
import ProgressDots from './carousel/ProgressDots';
import VisibilityToggle from './carousel/VisibilityToggle';
import DropOverlay from './carousel/DropOverlay';
import PublishButton, { type UploadProgress } from './carousel/PublishButton';
import { MetadataField, MetadataGroup } from './carousel/PhotoMetadata';
import { PlusIcon, TrashIcon } from './icons';

const DEFAULT_GALLERY_TITLE = 'Untitled Gallery';

const HiddenInput = styled('input')({
    display: 'none',
});

/**
 * A borderless text field that reads as body copy until you interact with it.
 * Everything typographic is inherited, so the surrounding `sx` decides how the
 * text looks and the input just becomes editable in place.
 */
const EditableInput = styled('input')({
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    color: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    backgroundColor: 'transparent',
    border: '1px dashed transparent',
    padding: '2px',
    margin: '-2px',
    width: '100%',
    '&:hover': {
        borderColor: colors.borderLight,
    },
    '&:focus-visible': {
        outline: `2px solid ${colors.text}`,
        outlineOffset: '2px',
        borderColor: 'transparent',
        backgroundColor: colors.surfaceBright,
    },
});

/** Shared frame around every card in the deck, editable or not. */
const cardSx = {
    minWidth: { xs: '100%', md: '85%' },
    scrollSnapAlign: 'center',
    border: `1px solid ${colors.borderLight}`,
    backgroundColor: colors.onPrimary,
    p: { xs: 2, md: 3 },
    display: 'flex',
    flexDirection: 'column',
} as const;

/** Trailing tile that opens the file picker. */
function AddPhotoCard({ onFilesPicked }: { onFilesPicked: (files: File[]) => void }) {
    const { t } = useTranslation();

    return (
        <Box sx={cardSx}>
            <Box sx={{ width: '100%', height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <label htmlFor="upload-image-button">
                    <HiddenInput
                        accept="image/*"
                        id="upload-image-button"
                        type="file"
                        multiple
                        onChange={(event) => {
                            const files = event.target.files;
                            if (files && files.length > 0) onFilesPicked(Array.from(files));
                        }}
                    />
                    <ButtonBase
                        component="span"
                        disableRipple
                        sx={{
                            flexDirection: 'column',
                            border: `1px dashed ${colors.borderLight}`,
                            p: 6,
                            borderRadius: '0px',
                            transition: 'border-color 0.3s ease, background-color 0.3s ease',
                            '&:hover': {
                                borderColor: colors.textSecondary,
                                backgroundColor: colors.hoverOverlaySubtle,
                            },
                        }}
                    >
                        <PlusIcon size={24} style={{ marginBottom: '16px', color: colors.textSecondary }} />
                        <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, letterSpacing: '0.05em' }}>
                            {t('editableGallery.clickToUpload')}
                        </Typography>
                    </ButtonBase>
                </label>
            </Box>
        </Box>
    );
}

interface EditablePhotoCardProps {
    photo: CarouselPhoto;
    onChange: (changes: Partial<CarouselPhoto>) => void;
    onMetadataChange: (field: keyof Photo['metadata'], value: string) => void;
    onRemove: () => void;
}

/** A staged photo with its caption and EXIF fields open for editing. */
function EditablePhotoCard({ photo, onChange, onMetadataChange, onRemove }: EditablePhotoCardProps) {
    const { t } = useTranslation();

    return (
        <Box sx={cardSx}>
            <Box sx={{ width: '100%', aspectRatio: { xs: '4/3', md: '16/9' }, backgroundColor: '#F3F3F3', mb: 3, position: 'relative' }}>
                <img
                    src={photo.src}
                    alt={photo.title || 'Photo to upload'}
                    loading="lazy"
                    width={1200}
                    height={675}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <IconButton
                    onClick={onRemove}
                    aria-label="Remove photo"
                    sx={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        zIndex: 50,
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                        border: `1px solid ${colors.primary}`,
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
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
                        '&:hover': {
                            backgroundColor: colors.danger,
                            borderColor: colors.danger,
                            color: colors.onPrimary,
                        },
                    }}
                >
                    <TrashIcon size={14} strokeWidth={2} />
                    <span>{t('editableGallery.delete')}</span>
                </IconButton>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: '200px' }}>
                    <Box sx={{ fontFamily: typography.headline, fontSize: { xs: '20px', md: '24px' }, color: colors.text, mb: 0.5 }}>
                        <EditableInput
                            value={photo.title}
                            onChange={(e) => onChange({ title: e.target.value })}
                            placeholder="Enter title…"
                            aria-label="Photo title"
                            spellCheck={false}
                        />
                    </Box>
                    <Box sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic' }}>
                        <EditableInput
                            value={photo.description}
                            onChange={(e) => onChange({ description: e.target.value })}
                            placeholder="Description…"
                            aria-label="Photo description"
                        />
                    </Box>
                </Box>

                <MetadataGroup>
                    <MetadataField label={t('editableGallery.exposure')}>
                        <EditableInput
                            value={photo.metadata.exposure}
                            onChange={(e) => onMetadataChange('exposure', e.target.value)}
                            style={{ width: '100px' }}
                            aria-label="Exposure"
                            spellCheck={false}
                        />
                    </MetadataField>
                    <MetadataField label={t('editableGallery.iso')}>
                        <EditableInput
                            value={photo.metadata.iso}
                            onChange={(e) => onMetadataChange('iso', e.target.value)}
                            style={{ width: '60px' }}
                            aria-label="ISO"
                            inputMode="numeric"
                            spellCheck={false}
                        />
                    </MetadataField>
                    <MetadataField label={t('editableGallery.lens')}>
                        <EditableInput
                            value={photo.metadata.lens}
                            onChange={(e) => onMetadataChange('lens', e.target.value)}
                            style={{ width: '80px' }}
                            aria-label="Lens"
                            spellCheck={false}
                        />
                    </MetadataField>
                </MetadataGroup>
            </Box>
        </Box>
    );
}

interface EditableGalleryCarouselProps {
    /** Lets the studio reload its published exhibitions once one is added. */
    onPublishSuccess?: () => void;
}

/**
 * The studio's composer: stage photos from the file picker or a drag-and-drop,
 * caption them, then publish the set as one exhibition.
 *
 * Staged photos live only in component state, previewed from `blob:` URLs, and
 * nothing reaches Appwrite until Publish succeeds as a whole.
 */
export default function EditableGalleryCarousel({ onPublishSuccess }: EditableGalleryCarouselProps) {
    const { t } = useTranslation();
    const { user, loading } = useAuth();

    const [items, setItems] = React.useState<CarouselPhoto[]>([createEmptyDraft()]);
    const [exhibitionTitle, setExhibitionTitle] = React.useState(DEFAULT_GALLERY_TITLE);
    const [isPublicDraft, setIsPublicDraft] = React.useState(false);
    const [isPublishing, setIsPublishing] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<UploadProgress | null>(null);
    const [toast, setToast] = React.useState<{ text: string; type: 'error' | 'success' } | null>(null);

    const { scrollRef, activeIndex, setActiveIndex, goPrev, goNext, resetToStart, onScroll } = useCarouselScroll();
    useRevokeObjectUrls(items);

    const addFiles = async (files: File[]) => {
        const newPhotos = await processFiles(files);
        if (newPhotos.length === 0) return;

        // Newest first, with the "add a photo" tile kept at the end.
        setItems((prev) => [...newPhotos, ...prev.filter((item) => !item.isNew), createEmptyDraft()]);
        resetToStart();
    };

    const { isDraggingOver, dropZoneProps } = useFileDropZone(addFiles);

    const removePhoto = (id: string) => {
        revokeIfObjectUrl(items.find((item) => item.id === id)?.src);

        const remaining = items.filter((item) => item.id !== id);
        setItems(remaining);
        // Pull the marker back in range if the card removed was the last one.
        setActiveIndex((prev) => (prev >= remaining.length ? Math.max(0, remaining.length - 1) : prev));
    };

    const updatePhoto = (id: string, changes: Partial<CarouselPhoto>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    };

    const updateMetadata = (id: string, field: keyof Photo['metadata'], value: string) => {
        setItems((prev) => prev.map((item) => (
            item.id === id ? { ...item, metadata: { ...item.metadata, [field]: value } } : item
        )));
    };

    /** Clears the editor back to an empty draft after a successful publish. */
    const resetEditor = () => {
        items.forEach((item) => revokeIfObjectUrl(item.src));
        setExhibitionTitle(DEFAULT_GALLERY_TITLE);
        setIsPublicDraft(false);
        setItems([createEmptyDraft()]);
        resetToStart();
    };

    const handlePublish = async () => {
        if (!user) return;

        const problem = validateDraft(exhibitionTitle, items);
        if (problem) {
            setToast({ text: problem, type: 'error' });
            return;
        }

        const photos = unpublishedPhotos(items).map((item) => ({
            ...item,
            title: item.title?.trim() || '',
        }));
        const draft: Gallery = {
            id: Date.now().toString(),
            title: exhibitionTitle,
            userId: user.$id,
            photos,
        };

        setIsPublishing(true);
        setUploadProgress({ current: 0, total: photos.length });
        try {
            await createGallery(exhibitionTitle, draft, isPublicDraft, (current, total) => {
                setUploadProgress({ current, total });
            });

            setToast({ text: 'Successfully published all photos!', type: 'success' });
            resetEditor();
            onPublishSuccess?.();
        } catch (error) {
            console.error('Publish failed:', error);
            setToast({ text: 'Publish failed. Please try again.', type: 'error' });
        } finally {
            setIsPublishing(false);
            setUploadProgress(null);
        }
    };

    if (loading || !user) {
        return null;
    }

    const hasStagedPhotos = items.some((item) => item.file);

    return (
        <Box
            {...dropZoneProps}
            sx={{
                pt: { xs: 8, md: 5 },
                pb: { xs: 12, md: 16 },
                backgroundColor: colors.surface,
                position: 'relative',
            }}
        >
            {isDraggingOver && <DropOverlay />}

            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>

                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1.5, flexWrap: 'wrap', gap: 3 }}>
                    <Box>
                        <Typography
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '18px',
                                fontWeight: 500,
                                letterSpacing: '0.1em',
                                color: colors.textSecondary,
                                textTransform: 'uppercase',
                                mb: 2,
                            }}
                        >
                            {t('editableGallery.studioUpload')}
                        </Typography>
                        <Typography
                            variant="h2"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '36px', md: '48px' },
                                fontWeight: 400,
                                color: colors.text,
                                letterSpacing: '-0.02em',
                                display: 'flex',
                                width: '100%',
                                maxWidth: '600px',
                            }}
                        >
                            <EditableInput
                                value={exhibitionTitle}
                                onChange={(e) => setExhibitionTitle(e.target.value)}
                                placeholder="Enter exhibition title…"
                                aria-label="Exhibition title"
                                spellCheck={false}
                            />
                        </Typography>
                    </Box>

                    {/* Publishing controls appear only once there is something to publish. */}
                    {hasStagedPhotos && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <VisibilityToggle
                                isPublic={isPublicDraft}
                                onToggle={() => setIsPublicDraft(!isPublicDraft)}
                                disabled={isPublishing}
                                size="medium"
                            />
                            <PublishButton onClick={handlePublish} isPublishing={isPublishing} progress={uploadProgress} />
                        </Box>
                    )}
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <CarouselArrow direction="prev" onClick={goPrev} disabled={activeIndex === 0} />
                    <CarouselArrow direction="next" onClick={goNext} disabled={activeIndex === items.length - 1} />

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
                        }}
                    >
                        {items.map((item) => (
                            item.isNew ? (
                                <AddPhotoCard key={item.id} onFilesPicked={addFiles} />
                            ) : (
                                <EditablePhotoCard
                                    key={item.id}
                                    photo={item}
                                    onChange={(changes) => updatePhoto(item.id, changes)}
                                    onMetadataChange={(field, value) => updateMetadata(item.id, field, value)}
                                    onRemove={() => removePhoto(item.id)}
                                />
                            )
                        ))}
                    </Box>
                </Box>

                <ProgressDots count={items.length} activeIndex={activeIndex} />

            </Container>

            <Toast message={toast?.text ?? null} severity={toast?.type ?? 'error'} onClose={() => setToast(null)} />
        </Box>
    );
}
