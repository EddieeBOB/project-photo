import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { colors, typography, PrimaryButton } from '../theme';
import { uploadImage } from '../services/photoService';
import { account } from '../lib/appwrite';

export interface CarouselItem {
    id: number | string;
    src: string;
    title: string;
    author: string;
    exhibitionTitle?: string;
    metadata: {
        exposure: string;
        iso: string;
        lens: string;
    };
    isNew?: boolean;
    file?: File;
}

const ProgressBar = styled(Box)(({ active }: { active: boolean }) => ({
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
    '&:focus': {
        outline: 'none',
        borderColor: colors.textSecondary,
        backgroundColor: colors.surfaceBright,
    }
});

export default function EditableGalleryCarousel() {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [isPublishing, setIsPublishing] = React.useState(false);
    const [exhibitionTitle, setExhibitionTitle] = React.useState("Untitled Gallery");
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const handleExhibitionTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setExhibitionTitle(newTitle);
        setItems(prev => prev.map(item => ({ ...item, exhibitionTitle: newTitle })));
    };

    const [items, setItems] = React.useState<CarouselItem[]>([
        {
            id: 'placeholder',
            src: '',
            title: '',
            author: '',
            metadata: { exposure: '', iso: '', lens: '' },
            isNew: true
        }
    ]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollPosition = scrollRef.current.scrollLeft;
            const itemWidth = scrollRef.current.clientWidth;
            const newIndex = Math.round(scrollPosition / itemWidth);
            setActiveIndex(newIndex);
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            const newItem: CarouselItem = {
                id: Date.now().toString(),
                src: previewUrl,
                title: 'Untitled Photo',
                author: 'You',
                exhibitionTitle: exhibitionTitle,
                metadata: {
                    exposure: '1/125 · f/8.0',
                    iso: '100',
                    lens: '35mm'
                },
                file: file
            };

            // Add new item before the placeholder
            setItems(prev => {
                const placeholder = prev.find(item => item.isNew);
                const existingItems = prev.filter(item => !item.isNew);
                return [newItem, ...existingItems, placeholder!];
            });
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
        try {
            setIsPublishing(true);
            const currentUser = await account.get();
            const userId = currentUser.$id;

            const unpublishedItems = items.filter(item => item.file);
            if (unpublishedItems.length === 0) {
                alert("No new photos to publish.");
                return;
            }

            for (const item of unpublishedItems) {
                const description = `${item.exhibitionTitle || 'Studio Collection'} · ${item.metadata.exposure} | ISO ${item.metadata.iso} | ${item.metadata.lens}`;
                await uploadImage(item.file!, item.title, description, userId);
            }

            alert("Successfully published all photos!");
            setExhibitionTitle("Upload and Curate");
            setItems([
                {
                    id: 'placeholder',
                    src: '',
                    title: '',
                    author: '',
                    metadata: { exposure: '', iso: '', lens: '' },
                    isNew: true
                }
            ]);
            setActiveIndex(0);
        } catch (error: any) {
            console.error("Publish failed:", error);
            alert("Publish failed: " + error.message);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#F9F9F9' }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>

                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 6, flexWrap: 'wrap', gap: 3 }}>
                    <Box>
                        <Typography
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '18px',
                                fontWeight: 500,
                                letterSpacing: '0.1em',
                                color: colors.textSecondary,
                                textTransform: 'uppercase',
                                mb: 1
                            }}
                        >
                            STUDIO | UPLOAD AND CREATE
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
                                placeholder="Enter exhibition title..."
                            />
                        </Typography>
                    </Box>
                    {items.some(item => item.file) && (
                        <PrimaryButton
                            onClick={handlePublish}
                            disabled={isPublishing}
                            sx={{
                                height: 'fit-content',
                                minWidth: '150px'
                            }}
                        >
                            {isPublishing ? (
                                <>
                                    <CircularProgress size={16} sx={{ color: 'inherit', mr: 1 }} />
                                    Publishing...
                                </>
                            ) : (
                                'Publish'
                            )}
                        </PrimaryButton>
                    )}
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
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    borderColor: colors.textSecondary,
                                                    backgroundColor: 'rgba(0,0,0,0.02)'
                                                }
                                            }}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', color: colors.textSecondary }}>
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                            <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, letterSpacing: '0.05em' }}>
                                                CLICK TO UPLOAD
                                            </Typography>
                                        </ButtonBase>
                                    </label>
                                </Box>
                            ) : (
                                /* Editable Card */
                                <>
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
                                        <Box sx={{ flex: 1, minWidth: '200px' }}>
                                            <Box sx={{ fontFamily: typography.headline, fontSize: { xs: '20px', md: '24px' }, color: colors.text, mb: 0.5 }}>
                                                <EditableInput
                                                    value={item.title}
                                                    onChange={(e) => updateItemField(item.id, 'title', e.target.value)}
                                                    placeholder="Enter title..."
                                                />
                                            </Box>
                                            <Box sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic' }}>
                                                <EditableInput
                                                    value={item.author}
                                                    onChange={(e) => updateItemField(item.id, 'author', e.target.value)}
                                                    placeholder="Author name..."
                                                />
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, borderLeft: `1px solid ${colors.borderLight}`, pl: { xs: 2, md: 3 } }}>
                                            <Box>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Exposure</Typography>
                                                <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                    <EditableInput
                                                        value={item.metadata.exposure}
                                                        onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'exposure')}
                                                        style={{ width: '100px' }}
                                                    />
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>ISO</Typography>
                                                <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                    <EditableInput
                                                        value={item.metadata.iso}
                                                        onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'iso')}
                                                        style={{ width: '60px' }}
                                                    />
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontFamily: typography.ui, fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Lens</Typography>
                                                <Box sx={{ fontFamily: typography.ui, fontSize: '12px', fontWeight: 600, color: colors.text }}>
                                                    <EditableInput
                                                        value={item.metadata.lens}
                                                        onChange={(e) => updateItemField(item.id, 'metadata', e.target.value, 'lens')}
                                                        style={{ width: '80px' }}
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

                {/* Dots */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
                    {items.map((_, index) => (
                        <ProgressBar key={index} active={index === activeIndex} />
                    ))}
                </Box>

            </Container>
        </Box>
    );
}
