import * as React from 'react';
import GalleryCarousel, { GalleryCarouselSkeleton } from '../components/GalleryCarousel';
import type { Gallery, CarouselPhoto } from '../components/EditableGalleryCarousel';
import { fetchUserGallery, fetchUserGalleryByUsername, mapGalleryToCarousel } from '../services/photoService';
import { useAuth } from '../contexts/AuthContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { colors, typography, PrimaryButton } from '../theme';
import { useNavigate } from 'react-router-dom';

export default function GalleryPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [userGalleries, setUserGalleries] = React.useState<(Gallery & { photos: CarouselPhoto[] })[]>([]);
    const [creatorGalleries, setCreatorGalleries] = React.useState<(Gallery & { photos: CarouselPhoto[] })[]>([]);
    const [fetching, setFetching] = React.useState(true);

    React.useEffect(() => {
        let isMounted = true;
        setFetching(true);

        const loadGalleryData = async () => {
            try {
                if (user) {
                    const fetchedUser = await fetchUserGallery(user.$id);
                    if (!isMounted) return;

                    const galleries = fetchedUser?.gallery || [];
                    const mappedGalleries = galleries.map((fetchedGallery: any) =>
                        mapGalleryToCarousel(fetchedGallery, user.$id)
                    ).filter(Boolean);

                    setUserGalleries(mappedGalleries as unknown as (Gallery & { photos: CarouselPhoto[] })[]);
                    setCreatorGalleries([]);
                } else {
                    const creatorUser = await fetchUserGalleryByUsername('EddieeBOB');
                    if (!isMounted) return;

                    if (creatorUser) {
                        const galleries = creatorUser.gallery || [];
                        const publicGalleries = galleries.filter((g: any) => g.isPublic);
                        const mappedGalleries = publicGalleries.map((fetchedGallery: any) =>
                            mapGalleryToCarousel(fetchedGallery, creatorUser.$id)
                        ).filter(Boolean);

                        setCreatorGalleries(mappedGalleries as unknown as (Gallery & { photos: CarouselPhoto[] })[]);
                    } else {
                        setCreatorGalleries([]);
                    }
                    setUserGalleries([]);
                }
            } catch (error) {
                if (isMounted) {
                    console.error("Failed to load gallery data:", error);
                }
            } finally {
                if (isMounted) {
                    setFetching(false);
                }
            }
        };

        loadGalleryData();

        return () => {
            isMounted = false;
        };
    }, [user]);

    if (loading || fetching) {
        return (
            <Box sx={{ pt: 0 }}>
                <GalleryCarouselSkeleton disableHeaderPadding />
            </Box>
        );
    }

    const hasPublicGallery = userGalleries.some(g => g.isPublic);

    return (
        <Box sx={{ pt: 0 }}>
            {user && !hasPublicGallery && (
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
                            gap: 3
                        }}
                    >
                        <Box sx={{ maxWidth: '650px' }}>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontFamily: typography.headline,
                                    fontSize: '24px',
                                    color: colors.text,
                                    mb: 1.5,
                                    fontWeight: 400
                                }}
                            >
                                Share Your Collection
                            </Typography>
                            <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6 }}>
                                You haven't posted any public exhibitions yet. Toggle your exhibitions to Public in the Studio to display them on your public profile.
                            </Typography>
                        </Box>
                        <PrimaryButton
                            onClick={() => navigate('/studio')}
                            sx={{ flexShrink: 0 }}
                        >
                            Go to Studio
                        </PrimaryButton>
                    </Box>
                </Container>
            )}

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
                            pb: 3
                        }}
                    >
                        The Creator's Gallery
                    </Typography>
                </Container>
            )}

            {!user && creatorGalleries.length === 0 && <GalleryCarousel />}
            {!user && creatorGalleries.map((gallery, index) => (
                <GalleryCarousel
                    key={gallery.id}
                    gallery={gallery}
                    index={index}
                    authorName="EddieeBOB"
                    disableHeaderPadding={index === 0}
                />
            ))}
            {user && userGalleries.map((gallery, index) => (
                <GalleryCarousel
                    key={gallery.id}
                    gallery={gallery}
                    index={index}
                    authorName={user.name || 'You'}
                    disableHeaderPadding={!hasPublicGallery && index === 0}
                />
            ))}
        </Box>
    );
}

