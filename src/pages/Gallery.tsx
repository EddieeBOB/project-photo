import * as React from 'react';
import type { Models } from 'appwrite';
import GalleryCarousel from '../components/GalleryCarousel';
import type { Gallery, CarouselPhoto } from '../components/EditableGalleryCarousel';
import { fetchUserGallery, mapGalleryToCarousel } from '../services/photoService';
import { useAuth } from '../contexts/AuthContext';
import Box from '@mui/material/Box';

export default function GalleryPage() {
    const { user, loading } = useAuth();
    const [userGalleries, setUserGalleries] = React.useState<(Gallery & { photos: CarouselPhoto[] })[]>([]);

    React.useEffect(() => {
        if (!user) {
            setUserGalleries([]);
            return;
        }

        let isMounted = true;

        const loadGallery = async () => {
            try {
                const fetchedUser = await fetchUserGallery(user.$id);
                if (!isMounted) return;

                const galleries = fetchedUser?.gallery || [];
                const mappedGalleries = galleries.map((fetchedGallery: any) => 
                    mapGalleryToCarousel(fetchedGallery, user.$id)
                ).filter(Boolean);

                setUserGalleries(mappedGalleries as unknown as (Gallery & { photos: CarouselPhoto[] })[]);
            } catch (error) {
                if (isMounted) {
                    console.error("Failed to load user gallery:", error);
                }
            }
        };

        loadGallery();

        return () => {
            isMounted = false;
        };
    }, [user]);

    if (loading) return null;

    return (
        <Box sx={{ pt: user && userGalleries.length === 0 ? { xs: 8, md: 10 } : 0 }}>
            {!user && <GalleryCarousel />}
            {user && userGalleries.map((gallery, index) => (
                <GalleryCarousel
                    key={gallery.id}
                    gallery={gallery}
                    index={index}
                    authorName={user.name || 'You'}
                />
            ))}
        </Box>
    );
}
