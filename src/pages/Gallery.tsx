import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';

import GalleryCarousel from '../components/GalleryCarousel';
import GalleryCarouselSkeleton from '../components/carousel/GalleryCarouselSkeleton';
import type { GalleryWithPhotos } from '../types/gallery';
import { mapGalleryToCarousel } from '../services/galleryService';
import { fetchUserGallery, fetchUserGalleryByUsername } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { isPresent } from '../utils/isPresent';
import { colors, typography, PrimaryButton } from '../theme';

/**
 * Whose work signed-out visitors see. Until the platform has more
 * photographers to rotate through, the site owner's public exhibitions stand
 * in as the showcase.
 */
const SHOWCASE_USERNAME = 'EddieeBOB';

/** Every exhibition owned by the signed-in user, published or not. */
async function loadOwnGalleries(userId: string): Promise<GalleryWithPhotos[]> {
    const profile = await fetchUserGallery(userId);
    return (profile?.gallery ?? [])
        .map((gallery) => mapGalleryToCarousel(gallery, userId))
        .filter(isPresent);
}

/** The showcase photographer's public exhibitions. */
async function loadShowcaseGalleries(): Promise<GalleryWithPhotos[]> {
    const profile = await fetchUserGalleryByUsername(SHOWCASE_USERNAME);
    if (!profile) return [];

    return (profile.gallery ?? [])
        .filter((gallery) => gallery.isPublic)
        .map((gallery) => mapGalleryToCarousel(gallery, profile.$id))
        .filter(isPresent);
}

/** Nudge for a signed-in user who has published nothing publicly yet. */
function ShareCollectionPrompt({ onGoToStudio }: { onGoToStudio: () => void }) {
    return (
        <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, pt: { xs: 12, md: 16 }, pb: 2 }}>
            <Box
                sx={{
                    border: `1px solid ${colors.borderLight}`,
                    backgroundColor: colors.surface,
                    p: { xs: 4, md: 6 },
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    gap: 3,
                }}
            >
                <Box sx={{ maxWidth: '650px' }}>
                    <Typography
                        variant="h4"
                        sx={{ fontFamily: typography.headline, fontSize: '24px', color: colors.text, mb: 1.5, fontWeight: 400 }}
                    >
                        Share Your Collection
                    </Typography>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                        You haven't posted any public exhibitions yet. Toggle your exhibitions to Public in the Studio to display them on your public profile.
                    </Typography>
                </Box>
                <PrimaryButton onClick={onGoToStudio} sx={{ flexShrink: 0 }}>
                    Go to Studio
                </PrimaryButton>
            </Box>
        </Container>
    );
}

/**
 * The /gallery page. Signed in, it shows your own exhibitions; signed out, the
 * showcase photographer's — falling back to the built-in demo deck if there is
 * nothing published at all.
 */
export default function GalleryPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [galleries, setGalleries] = React.useState<GalleryWithPhotos[]>([]);
    const [fetching, setFetching] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while the async fetch below runs
        setFetching(true);

        const load = async () => {
            try {
                const loaded = user ? await loadOwnGalleries(user.$id) : await loadShowcaseGalleries();
                if (!cancelled) setGalleries(loaded);
            } catch (error) {
                if (!cancelled) console.error('Failed to load gallery data:', error);
            } finally {
                if (!cancelled) setFetching(false);
            }
        };

        load();

        // Stop a response for the previous user from landing after a sign-in/out.
        return () => { cancelled = true; };
    }, [user]);

    if (loading || fetching) {
        return (
            <Box sx={{ pt: 0 }}>
                <GalleryCarouselSkeleton disableHeaderPadding />
            </Box>
        );
    }

    // Only a signed-in user's own galleries count here: the showcase decks are
    // public by definition and shouldn't suppress the first carousel's padding.
    const hasPublicGallery = Boolean(user) && galleries.some((gallery) => gallery.isPublic);
    const showDemoGallery = !user && galleries.length === 0;

    return (
        <Box sx={{ pt: 0 }}>
            {user && !hasPublicGallery && <ShareCollectionPrompt onGoToStudio={() => navigate('/studio')} />}

            {!user && (
                <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, pt: { xs: 12, md: 16 } }}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '32px', md: '44px' },
                            fontWeight: 400,
                            color: colors.text,
                            letterSpacing: '-0.02em',
                            borderBottom: `1px solid ${colors.borderLight}`,
                            pb: 3,
                        }}
                    >
                        My Gallery
                    </Typography>
                </Container>
            )}

            {showDemoGallery && <GalleryCarousel />}

            {galleries.map((gallery, index) => (
                <GalleryCarousel
                    key={gallery.id}
                    gallery={gallery}
                    index={index}
                    authorName={user ? (user.name || 'You') : SHOWCASE_USERNAME}
                    disableHeaderPadding={!hasPublicGallery && index === 0}
                />
            ))}
        </Box>
    );
}
