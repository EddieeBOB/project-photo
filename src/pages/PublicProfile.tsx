import * as React from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

import GalleryCarousel from '../components/GalleryCarousel';
import GalleryCarouselSkeleton from '../components/carousel/GalleryCarouselSkeleton';
import type { GalleryWithPhotos } from '../types/gallery';
import { mapGalleryToCarousel } from '../services/galleryService';
import { fetchUserGalleryByUsername } from '../services/userService';
import { isPresent } from '../utils/isPresent';
import { colors, typography } from '../theme';

interface ProfileData {
    artistName: string;
    galleries: GalleryWithPhotos[];
}

/** Empty state for a username that exists but has published nothing publicly. */
function NoExhibitions() {
    return (
        <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: 10 }}>
            <Box sx={{ border: `1px dashed ${colors.borderLight}`, py: 8, px: 3, textAlign: 'center' }}>
                <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                    This photographer has not published any public exhibitions yet.
                </Typography>
            </Box>
        </Container>
    );
}

/**
 * A photographer's public page at /user/:username.
 *
 * Only galleries explicitly marked public are listed. Appwrite would refuse to
 * serve the others anyway, but filtering here keeps a private exhibition from
 * appearing as an empty card.
 */
export default function PublicProfile() {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [notFound, setNotFound] = React.useState(false);

    React.useEffect(() => {
        if (!username) return;

        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading/error state before re-fetching on username change
        setLoading(true);
        setNotFound(false);

        const load = async () => {
            try {
                const fetched = await fetchUserGalleryByUsername(username);
                if (cancelled) return;

                if (!fetched) {
                    setNotFound(true);
                    return;
                }

                setProfile({
                    artistName: fetched.username || 'Artist',
                    galleries: (fetched.gallery ?? [])
                        .map((gallery) => mapGalleryToCarousel(gallery, fetched.$id))
                        .filter(isPresent)
                        .filter((gallery) => gallery.isPublic),
                });
            } catch (error) {
                console.error('Failed to load public profile:', error);
                if (!cancelled) setNotFound(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => { cancelled = true; };
    }, [username]);

    if (loading) {
        return (
            <Box sx={{ pt: { xs: 8, md: 16 }, pb: 8, backgroundColor: colors.surfaceBright }}>
                <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, mb: 4 }}>
                    <Box className="skeleton" sx={{ width: { xs: '200px', md: '300px' }, height: { xs: '36px', md: '56px' }, mb: 2 }} />
                    <Box className="skeleton" sx={{ width: '120px', height: '14px' }} />
                </Container>
                <GalleryCarouselSkeleton disableHeaderPadding />
            </Box>
        );
    }

    if (notFound || !profile) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', px: 3, backgroundColor: colors.surfaceBright }}>
                <Typography variant="h1" sx={{ fontFamily: typography.headline, fontSize: '48px', color: colors.text, mb: 2 }}>
                    Profile Not Found
                </Typography>
                <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                    The requested photographer profile does not exist or has been removed.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ pt: { xs: 8, md: 16 }, pb: 8, backgroundColor: colors.surfaceBright }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, mb: 4 }}>
                <Typography
                    variant="h1"
                    sx={{
                        fontFamily: typography.headline,
                        fontSize: { xs: '36px', md: '56px' },
                        fontWeight: 400,
                        color: colors.text,
                        mb: 1,
                        letterSpacing: '-0.02em',
                    }}
                >
                    {profile.artistName}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        fontFamily: typography.ui,
                        fontSize: '14px',
                        color: colors.textSecondary,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                    }}
                >
                    Public Exhibitions
                </Typography>
            </Container>

            {profile.galleries.length > 0 ? (
                profile.galleries.map((gallery, index) => (
                    <GalleryCarousel
                        key={gallery.id}
                        gallery={gallery}
                        index={index}
                        authorName={profile.artistName}
                    />
                ))
            ) : (
                <NoExhibitions />
            )}
        </Box>
    );
}
