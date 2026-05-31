import * as React from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import GalleryCarousel, { GalleryCarouselSkeleton } from '../components/GalleryCarousel';
import type { Gallery, CarouselPhoto } from '../components/EditableGalleryCarousel';
import { fetchUserGalleryByUsername, mapGalleryToCarousel } from '../services/photoService';
import { colors, typography } from '../theme';

export default function PublicProfile() {
    const { username } = useParams<{ username: string }>();
    const [loading, setLoading] = React.useState(true);
    const [artistName, setArtistName] = React.useState<string>('');
    const [publicGalleries, setPublicGalleries] = React.useState<(Gallery & { photos: CarouselPhoto[] })[]>([]);
    const [error, setError] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (!username) return;

        let isMounted = true;
        setLoading(true);
        setError(false);

        const loadPublicProfile = async () => {
            try {
                const fetchedUser = await fetchUserGalleryByUsername(username);
                if (!isMounted) return;

                if (!fetchedUser) {
                    setError(true);
                    setLoading(false);
                    return;
                }

                const fullName = fetchedUser.username || 'Artist';
                setArtistName(fullName);

                const rawGalleries = fetchedUser.gallery || [];
                const mappedGalleries = rawGalleries
                    .map((fetchedGallery: any) => mapGalleryToCarousel(fetchedGallery, fetchedUser.$id))
                    .filter(Boolean)
                    .filter((g: any) => g.isPublic === true);

                setPublicGalleries(mappedGalleries);
            } catch (err) {
                console.error("Failed to load public profile:", err);
                if (isMounted) {
                    setError(true);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadPublicProfile();

        return () => {
            isMounted = false;
        };
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

    if (error || !artistName) {
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
                        letterSpacing: '-0.02em'
                    }}
                >
                    {artistName}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        fontFamily: typography.ui,
                        fontSize: '14px',
                        color: colors.textSecondary,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                    }}
                >
                    Public Exhibitions
                </Typography>
            </Container>

            {/* Public Galleries List */}
            {publicGalleries.length > 0 ? (
                publicGalleries.map((gallery, index) => (
                    <GalleryCarousel
                        key={gallery.id}
                        gallery={gallery}
                        index={index}
                        authorName={artistName}
                    />
                ))
            ) : (
                <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: 10 }}>
                    <Box sx={{ border: `1px dashed ${colors.borderLight}`, py: 8, px: 3, textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                            This photographer has not published any public exhibitions yet.
                        </Typography>
                    </Box>
                </Container>
            )}
        </Box>
    );
}
