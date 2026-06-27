import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import GalleryCarousel, { GalleryCarouselSkeleton } from '../components/GalleryCarousel';
import EditableGalleryCarousel, { type Gallery, type CarouselPhoto } from '../components/EditableGalleryCarousel';
import { deleteGallery, deletePhoto, fetchUserGallery, mapGalleryToCarousel, updateGalleryVisibility } from '../services/photoService';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';

export default function StudioWorkspace() {
    const { t } = useTranslation();
    const { user, loading } = useAuth();
    const [userGalleries, setUserGalleries] = React.useState<(Gallery & { photos: CarouselPhoto[] })[]>([]);
    const [fetching, setFetching] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const loadGallery = React.useCallback(async () => {
        if (!user) {
            if (isMountedRef.current) setUserGalleries([]);
            return;
        }

        if (isMountedRef.current) setFetching(true);
        try {
            const fetchedUser = await fetchUserGallery(user.$id);
            if (!isMountedRef.current) return;
            const galleries = fetchedUser?.gallery || [];

            const mappedGalleries = galleries.map((fetchedGallery: any) => 
                mapGalleryToCarousel(fetchedGallery, user.$id)
            ).filter(Boolean);

            if (isMountedRef.current) setUserGalleries(mappedGalleries);
        } catch (error) {
            if (isMountedRef.current) console.error("Failed to load user gallery in workspace:", error);
        } finally {
            if (isMountedRef.current) setFetching(false);
        }
    }, [user]);

    const handleDeleteGallery = React.useCallback(async (galleryId: string) => {
        try {
            await deleteGallery(galleryId);
            if (isMountedRef.current) setUserGalleries(prev => prev.filter(g => g.id !== galleryId));
        } catch (error: any) {
            if (isMountedRef.current) {
                console.error("Failed to delete gallery:", error);
                setErrorMsg("Failed to delete gallery. Please try again.");
            }
        }
    }, []);

    const handleTogglePublicGallery = React.useCallback(async (galleryId: string, isPublic: boolean) => {
        try {
            await updateGalleryVisibility(galleryId, isPublic);
            if (isMountedRef.current) {
                setUserGalleries(prev =>
                    prev.map(g => (g.id === galleryId ? { ...g, isPublic } : g))
                );
            }
        } catch (error: any) {
            if (isMountedRef.current) {
                console.error("Failed to update gallery visibility:", error);
                setErrorMsg("Failed to update gallery visibility. Please try again.");
            }
        }
    }, []);

    const handleDeletePhoto = React.useCallback(async (galleryId: string, photoId: string) => {
        try {
            await deletePhoto(photoId);
            if (isMountedRef.current) {
                setUserGalleries(prev =>
                    prev.map(g => {
                        if (g.id === galleryId) {
                            return {
                                ...g,
                                photos: g.photos.filter(p => p.id !== photoId)
                            };
                        }
                        return g;
                    })
                );
            }
        } catch (error: any) {
            if (isMountedRef.current) {
                console.error("Failed to delete photo:", error);
                setErrorMsg("Failed to delete photo. Please try again.");
            }
        }
    }, []);

    React.useEffect(() => {
        if (user) {
            loadGallery();
        } else {
            setUserGalleries([]);
        }
    }, [user, loadGallery]);

    if (loading) {
        return (
            <Box sx={{ pt: { xs: 8, md: 16 }, pb: 8 }}>
                <GalleryCarouselSkeleton disableHeaderPadding />
            </Box>
        );
    }

    return (
        <Box sx={{ pt: { xs: 8, md: 16 }, pb: 8 }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, mb: 2 }}>
                <Typography
                    variant="h1"
                    sx={{
                        fontFamily: typography.headline,
                        fontSize: { xs: '36px', md: '56px' },
                        color: colors.text,
                        mb: 1
                    }}
                >
                    {t('studioWorkspace.title')}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        fontFamily: typography.ui,
                        color: colors.textSecondary,
                        mb: 4
                    }}
                >
                    {t('studioWorkspace.description')}
                </Typography>
            </Container>

            {/* Existing Galleries List */}
            {fetching ? (
                <GalleryCarouselSkeleton disableHeaderPadding />
            ) : userGalleries.length > 0 ? (
                userGalleries.map((gallery, index) => (
                    <GalleryCarousel
                        key={gallery.id}
                        gallery={gallery}
                        index={index}
                        authorName={user?.name || 'You'}
                        onDelete={handleDeleteGallery}
                        onTogglePublic={handleTogglePublicGallery}
                        onDeletePhoto={handleDeletePhoto}
                        disableHeaderPadding
                    />
                ))
            ) : (
                <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: 6, mb: 4, border: `1px dashed ${colors.borderLight}` }}>
                    <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, textAlign: 'center' }}>
                        {t('studioWorkspace.noExhibitions')}
                    </Typography>
                </Container>
            )}

            {/* Editable Carousel for Uploading / Curating */}
            <EditableGalleryCarousel onPublishSuccess={loadGallery} />

            <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)}>
                <Alert onClose={() => setErrorMsg(null)} severity="error" sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}>
                    {errorMsg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
