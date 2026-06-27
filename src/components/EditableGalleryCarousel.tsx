import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import { useTranslation } from 'react-i18next';

import { colors, typography, PrimaryButton } from '../theme';
import { createGallery, processFiles } from '../services/photoService';
import { useAuth } from '../contexts/AuthContext';

export interface Gallery {
    id: string;
    title: string;
    userId: string;
    photos: Photo[];
    isPublic?: boolean;
}

export interface Photo {
    id: string;
    title: string;
    description: string;
    metadata: {
        exposure: string;
        iso: string;
        lens: string;
    };
    file?: File;
}

export type CarouselPhoto = Photo & {
    src?: string;
    isNew?: boolean;
};

const ProgressBar = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ active }) => ({
    height: '1px',
    width: '40px',
    backgroundColor: active ? colors.text : colors.borderLight,
    transition: 'background-color 0.3s ease',
}));

const HiddenInput = styled('input')({
    display: 'none',
});

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
    }
});

interface EditableGalleryCarouselProps {
    onPublishSuccess?: () => void;
}

export default function EditableGalleryCarousel({ onPublishSuccess }: EditableGalleryCarouselProps) {
    const { t } = useTranslation();
    const { user, loading } = useAuth();

    const [activeIndex, setActiveIndex] = React.useState(0);
    const [isPublishing, setIsPublishing] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number } | null>(null);
    const [isPublicDraft, setIsPublicDraft] = React.useState(false);
    const [exhibitionTitle, setExhibitionTitle] = React.useState("Untitled Gallery");
    const [toastMsg, setToastMsg] = React.useState<{text: string, type: 'error' | 'success'} | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const dragCounter = React.useRef(0);

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

    const handleExhibitionTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setExhibitionTitle(newTitle);
    };

    const [items, setItems] = React.useState<CarouselPhoto[]>([
        {
            id: 'placeholder',
            src: '',
            title: '',
            description: '',
            metadata: { exposure: '', iso: '', lens: '' },
            isNew: true
        }
    ]);

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

    const handleFiles = async (files: File[]) => {
        const newPhotos = await processFiles(files);
        if (newPhotos.length === 0) return;

        setItems(prev => {
            const placeholder = prev.find(item => item.isNew);
            const existingItems = prev.filter(item => !item.isNew);
            return [...newPhotos, ...existingItems, placeholder!];
        });

        // Set active index to the first of the newly added photos
        setActiveIndex(0);

        // Scroll to the first element
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (fileList && fileList.length > 0) {
            handleFiles(Array.from(fileList));
        }
    };

    const handleRemovePhoto = (id: string) => {
        // Revoke the object URL if it exists to prevent memory leaks
        const target = items.find(item => item.id === id);
        if (target?.src && target.src.startsWith('blob:')) {
            URL.revokeObjectURL(target.src);
        }

        const updated = items.filter(item => item.id !== id);
        setItems(updated);

        setActiveIndex(prevIndex => {
            if (prevIndex >= updated.length) {
                return Math.max(0, updated.length - 1);
            }
            return prevIndex;
        });
    };

    const blobUrlsRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        items.forEach(item => {
            if (item.src && item.src.startsWith('blob:')) {
                blobUrlsRef.current.add(item.src);
            }
        });
    }, [items]);

    React.useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current.clear();
        };
    }, []);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const files = Array.from(e.dataTransfer.files);
        if (files && files.length > 0) {
            handleFiles(files);
        }
    };

    const updateItemField = (id: string | number, field: string, value: string, nestedField?: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                if (nestedField) {
                    return {
                        ...item,
                        metadata: {
                            ...item.metadata,
                            [nestedField]: value
                        }
                    };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handlePublish = async () => {
        if (!user) return;

        try {
            setIsPublishing(true);
            const userId = user.$id;

            // --- Input Validation ---
            const MAX_TITLE_LENGTH = 100;
            const MAX_DESCRIPTION_LENGTH = 500;

            if (!exhibitionTitle.trim()) {
                setToastMsg({text: "Please enter a gallery title.", type: 'error'});
                return;
            }
            if (exhibitionTitle.length > MAX_TITLE_LENGTH) {
                setToastMsg({text: `Gallery title must be under ${MAX_TITLE_LENGTH} characters.`, type: 'error'});
                return;
            }

            const unpublishedItems = items.filter(item => item.file);
            if (unpublishedItems.length === 0) {
                setToastMsg({text: "No new photos to publish.", type: 'error'});
                return;
            }

            for (const item of unpublishedItems) {
                const itemTitle = item.title?.trim() || '';
                if (itemTitle.length > MAX_TITLE_LENGTH) {
                    setToastMsg({text: `Photo title "${itemTitle.substring(0, 20)}..." is too long (max ${MAX_TITLE_LENGTH} characters).`, type: 'error'});
                    return;
                }
                if ((item.description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
                    const displayName = itemTitle ? `"${itemTitle}"` : "this photo";
                    setToastMsg({text: `Description for ${displayName} is too long (max ${MAX_DESCRIPTION_LENGTH} characters).`, type: 'error'});
                    return;
                }
            }

            const galleryToUpload: Gallery = {
                id: Date.now().toString(),
                title: exhibitionTitle,
                userId: userId,
                photos: items.filter(item => item.file).map(item => ({
                    ...item,
                    title: item.title?.trim() || ''
                }))
            };

            setUploadProgress({ current: 0, total: galleryToUpload.photos.length });

            await createGallery(exhibitionTitle, userId, galleryToUpload, isPublicDraft, (current: number, total: number) => {
                setUploadProgress({ current, total });
            });

            setToastMsg({text: "Successfully published all photos!", type: 'success'});

            // Revoke all existing blob URLs before resetting state
            items.forEach(item => {
                if (item.src && item.src.startsWith('blob:')) {
                    URL.revokeObjectURL(item.src);
                }
            });

            setExhibitionTitle("Untitled Gallery");
            setIsPublicDraft(false);
            setItems([
                {
                    id: 'placeholder',
                    src: '',
                    title: '',
                    description: '',
                    metadata: { exposure: '', iso: '', lens: '' },
                    isNew: true
                }
            ]);
            setActiveIndex(0);

            if (onPublishSuccess) {
                onPublishSuccess();
            }
        } catch (error: any) {
            console.error("Publish failed:", error);
            setToastMsg({text: "Publish failed. Please try again.", type: 'error'});
        } finally {
            setIsPublishing(false);
            setUploadProgress(null);
        }
    };

    if (loading || !user) {
        return null;
    }

    return (
        <Box
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            sx={{
                pt: { xs: 8, md: 5 },
                pb: { xs: 12, md: 16 },
                backgroundColor: colors.surface,
                position: 'relative'
            }}
        >
            {isDragging && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: colors.scrim,
                        backdropFilter: 'blur(12px)',
                        border: `2px dashed ${colors.text}`,
                        borderRadius: '0px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        pointerEvents: 'none',
                        '@media (prefers-reduced-motion: no-preference)': {
                            animation: 'fadeIn 0.2s ease-in-out',
                        },
                        '@keyframes fadeIn': {
                            '0%': { opacity: 0 },
                            '100%': { opacity: 1 }
                        }
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            p: 4,
                            transform: 'scale(1)',
                            transformOrigin: 'center',
                            '@media (prefers-reduced-motion: no-preference)': {
                                animation: 'pulseScale 1.5s infinite ease-in-out',
                            },
                            '@keyframes pulseScale': {
                                '0%': { transform: 'scale(1)' },
                                '50%': { transform: 'scale(1.05)' },
                                '100%': { transform: 'scale(1)' }
                            }
                        }}
                    >
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={colors.text}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ marginBottom: '20px' }}
                            aria-hidden="true"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <Typography
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: '24px',
                                fontWeight: 400,
                                color: colors.text,
                                mb: 1,
                                letterSpacing: '-0.01em'
                            }}
                        >
                            {t('editableGallery.dropPhotos')}
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '14px',
                                color: colors.textSecondary,
                                letterSpacing: '0.02em'
                            }}
                        >
                            {t('editableGallery.releaseToAdd')}
                        </Typography>
                    </Box>
                </Box>
            )}
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
                                mb: 2
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
                                maxWidth: '600px'
                            }}
                        >
                            <EditableInput
                                value={exhibitionTitle}
                                onChange={handleExhibitionTitleChange}
                                placeholder="Enter exhibition title…"
                                aria-label="Exhibition title"
                                spellCheck={false}
                            />
                        </Typography>
                    </Box>
                    {items.some(item => item.file) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* Public/Private Selection */}
                            <IconButton
                                onClick={() => setIsPublicDraft(!isPublicDraft)}
                                disabled={isPublishing}
                                sx={{
                                    border: `1px solid ${colors.borderLight}`,
                                    borderRadius: '0px',
                                    p: '10px 14px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: typography.ui,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    gap: 1.5,
                                    alignItems: 'center',
                                    color: isPublicDraft ? colors.text : colors.textSecondary,
                                    borderColor: isPublicDraft ? colors.text : colors.borderLight,
                                    transition: 'border-color 0.3s ease, color 0.3s ease, background-color 0.3s ease',
                                    '&:hover': {
                                        borderColor: colors.text,
                                        color: colors.text,
                                        backgroundColor: colors.hoverOverlaySubtle
                                    }
                                }}
                                aria-label={isPublicDraft ? 'Set gallery to private' : 'Set gallery to public'}
                                aria-pressed={isPublicDraft}
                            >
                                {isPublicDraft ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="2" y1="12" x2="22" y2="12"></line>
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                        </svg>
                                        <span>Public</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <span>Private</span>
                                    </>
                                )}
                            </IconButton>

                            <PrimaryButton
                                onClick={handlePublish}
                                disabled={isPublishing}
                                sx={{
                                    height: 'fit-content',
                                    minWidth: '180px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    '&.Mui-disabled': {
                                        backgroundColor: colors.primary,
                                        color: colors.onPrimary,
                                        borderColor: colors.primary,
                                        opacity: 0.85
                                    }
                                }}
                            >
                                {isPublishing ? (
                                    <>
                                        {uploadProgress && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    bottom: 0,
                                                    width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    zIndex: 1
                                                }}
                                            />
                                        )}
                                        <Box sx={{ zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <CircularProgress size={16} sx={{ color: 'inherit', mr: 1 }} />
                                            <span>
                                                {uploadProgress
                                                    ? `Publishing (${uploadProgress.current}/${uploadProgress.total})…`
                                                    : 'Publishing…'}
                                            </span>
                                        </Box>
                                    </>
                                ) : (
                                    'Publish'
                                )}
                            </PrimaryButton>
                        </Box>
                    )}
                </Box>

                {/* Carousel Container Wrapper with Relative Position */}
                <Box sx={{ position: 'relative' }}>
                    {/* Previous Button */}
                    <IconButton
                        onClick={handlePrev}
                        disabled={activeIndex === 0}
                        aria-label="Previous photo"
                        sx={{
                            position: 'absolute',
                            left: { xs: '8px', md: '-24px' },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            backgroundColor: colors.surfaceBright,
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: '0px',
                            p: 1.5,
                            color: colors.text,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </IconButton>

                    {/* Next Button */}
                    <IconButton
                        onClick={handleNext}
                        disabled={activeIndex === items.length - 1}
                        aria-label="Next photo"
                        sx={{
                            position: 'absolute',
                            right: { xs: '8px', md: '-24px' },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            backgroundColor: colors.surfaceBright,
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${colors.borderLight}`,
                            borderRadius: '0px',
                            p: 1.5,
                            color: colors.text,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                            overscrollBehaviorX: 'contain',
                            touchAction: 'pan-x',
                            scrollSnapType: 'x mandatory',
                            scrollbarWidth: 'none',
                            '&::-webkit-scrollbar': { display: 'none' },
                            gap: 4,
                            pb: 2
                        }}
                    >
                        {items.map((item) => (
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
                                {item.isNew ? (
                                    /* Add New Card */
                                    <Box sx={{ width: '100%', height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <label htmlFor="upload-image-button">
                                            <HiddenInput
                                                accept="image/*"
                                                id="upload-image-button"
                                                type="file"
                                                multiple
                                                onChange={handleImageUpload}
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
                                                        backgroundColor: colors.hoverOverlaySubtle
                                                    }
                                                }}
                                            >
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', color: colors.textSecondary }} aria-hidden="true">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                </svg>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, letterSpacing: '0.05em' }}>
                                                    {t('editableGallery.clickToUpload')}
                                                </Typography>
                                            </ButtonBase>
                                        </label>
                                    </Box>
                                ) : (
                                    /* Editable Card */
                                    <>
                                        {/* Image */}
                                        <Box sx={{ width: '100%', aspectRatio: { xs: '4/3', md: '16/9' }, backgroundColor: '#F3F3F3', mb: 3, position: 'relative' }}>
                                            <img
                                                src={item.src}
                                                alt={item.title || 'Photo to upload'}
                                                crossOrigin="anonymous"
                                                loading="lazy"
                                                width={1200}
                                                height={675}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            {/* Remove Photo Button */}
                                            <IconButton
                                                onClick={() => handleRemovePhoto(item.id)}
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
                                                    }
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                                <span>{t('editableGallery.delete')}</span>
                                            </IconButton>
                                        </Box>

                                        {/* Footer of Card */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 3 }}>
                                            <Box sx={{ flex: 1, minWidth: '200px' }}>
                                                <Box sx={{ fontFamily: typography.headline, fontSize: { xs: '20px', md: '24px' }, color: colors.text, mb: 0.5 }}>
                                                    <EditableInput
                                                        value={item.title}
                                                        onChange={(e) => updateItemField(item.id, 'title', e.target.value)}
                                                        placeholder="Enter title…"
                                                        aria-label="Photo title"
                                                        spellCheck={false}
                                                    />
                                                </Box>
                                                <Box sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic' }}>
                                                    <EditableInput
                                                        value={item.description}
                                                        onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                                                        placeholder="Description…"
                                                        aria-label="Photo description"
                                                    />
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, borderLeft: `1px solid ${colors.borderLight}`, pl: { xs: 2, md: 3 } }}>
                                                <Box>
                                                    <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('editableGallery.exposure')}</Typography>
                                                    <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                        <EditableInput
                                                            value={item.metadata.exposure}
                                                            onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'exposure')}
                                                            style={{ width: '100px' }}
                                                            aria-label="Exposure"
                                                            spellCheck={false}
                                                        />
                                                    </Box>
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('editableGallery.iso')}</Typography>
                                                    <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                        <EditableInput
                                                            value={item.metadata.iso}
                                                            onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'iso')}
                                                            style={{ width: '60px' }}
                                                            aria-label="ISO"
                                                            inputMode="numeric"
                                                            spellCheck={false}
                                                        />
                                                    </Box>
                                                </Box>
                                                <Box>
                                                    <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('editableGallery.lens')}</Typography>
                                                    <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                        <EditableInput
                                                            value={item.metadata.lens}
                                                            onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'lens')}
                                                            style={{ width: '80px' }}
                                                            aria-label="Lens"
                                                            spellCheck={false}
                                                        />
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Dots */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
                    {items.map((_, index) => (
                        <ProgressBar key={index} active={index === activeIndex} />
                    ))}
                </Box>

            </Container>

            <Snackbar open={!!toastMsg} autoHideDuration={6000} onClose={() => setToastMsg(null)}>
                <Alert onClose={() => setToastMsg(null)} severity={toastMsg?.type || 'error'} sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}>
                    {toastMsg?.text}
                </Alert>
            </Snackbar>
        </Box>
    );
}
