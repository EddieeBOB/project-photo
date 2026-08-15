import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { useTranslation } from 'react-i18next';

import GalleryCarousel from '../components/GalleryCarousel';
import GalleryCarouselSkeleton from '../components/carousel/GalleryCarouselSkeleton';
import EditableGalleryCarousel from '../components/EditableGalleryCarousel';
import Toast from '../components/Toast';
import type { GalleryWithPhotos } from '../types/gallery';
import { deleteGallery, deletePhoto, mapGalleryToCarousel, updateGalleryVisibility } from '../services/galleryService';
import { fetchUserGallery } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { isPresent } from '../utils/isPresent';
import { colors, typography } from '../theme';

/**
 * The photographer's own workspace: their published exhibitions, each with
 * owner controls, above the editor for composing a new one.
 *
 * Every mutation updates local state directly instead of refetching — the
 * service call has already succeeded by then, and a round trip would make the
 * list flicker.
 */
export default function StudioWorkspace() {
    const { t } = useTranslation();
    const { user, loading } = useAuth();
    const [galleries, setGalleries] = React.useState<GalleryWithPhotos[]>([]);
    const [fetching, setFetching] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    const loadGalleries = React.useCallback(async () => {
        if (!user) {
            setGalleries([]);
            return;
        }

        setFetching(true);
        try {
            const profile = await fetchUserGallery(user.$id);
            const mapped = (profile?.gallery ?? [])
                .map((gallery) => mapGalleryToCarousel(gallery, user.$id))
                .filter(isPresent);
            setGalleries(mapped);
        } catch (error) {
            console.error('Failed to load user gallery in workspace:', error);
        } finally {
            setFetching(false);
        }
    }, [user]);

    React.useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- load the signed-in user's galleries; clear them on sign-out
        loadGalleries();
    }, [loadGalleries]);

    const handleDeleteGallery = React.useCallback(async (galleryId: string) => {
        try {
            await deleteGallery(galleryId);
            setGalleries((prev) => prev.filter((gallery) => gallery.id !== galleryId));
        } catch (error) {
            console.error('Failed to delete gallery:', error);
            setErrorMsg('Failed to delete gallery. Please try again.');
        }
    }, []);

    const handleTogglePublic = React.useCallback(async (galleryId: string, isPublic: boolean) => {
        try {
            await updateGalleryVisibility(galleryId, isPublic);
            setGalleries((prev) => prev.map((gallery) => (
                gallery.id === galleryId ? { ...gallery, isPublic } : gallery
            )));
        } catch (error) {
            console.error('Failed to update gallery visibility:', error);
            setErrorMsg('Failed to update gallery visibility. Please try again.');
        }
    }, []);

    const handleDeletePhoto = React.useCallback(async (galleryId: string, photoId: string) => {
        try {
            await deletePhoto(photoId);
            setGalleries((prev) => prev.map((gallery) => (
                gallery.id === galleryId
                    ? { ...gallery, photos: gallery.photos.filter((photo) => photo.id !== photoId) }
                    : gallery
            )));
        } catch (error) {
            console.error('Failed to delete photo:', error);
            setErrorMsg('Failed to delete photo. Please try again.');
        }
    }, []);

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
                    sx={{ fontFamily: typography.headline, fontSize: { xs: '36px', md: '56px' }, color: colors.text, mb: 1 }}
                >
                    {t('studioWorkspace.title')}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{ fontFamily: typography.ui, color: colors.textSecondary, mb: 4 }}
                >
                    {t('studioWorkspace.description')}
                </Typography>
            </Container>

            {/* Published exhibitions */}
            {fetching ? (
                <GalleryCarouselSkeleton disableHeaderPadding />
            ) : galleries.length > 0 ? (
                galleries.map((gallery, index) => (
                    <GalleryCarousel
                        key={gallery.id}
                        gallery={gallery}
                        index={index}
                        authorName={user?.name || 'You'}
                        onDelete={handleDeleteGallery}
                        onTogglePublic={handleTogglePublic}
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

            {/* Composer for a new exhibition */}
            <EditableGalleryCarousel onPublishSuccess={loadGalleries} />

            <Toast message={errorMsg} onClose={() => setErrorMsg(null)} />
        </Box>
    );
}
