import * as React from 'react';
import GalleryCarousel from '../components/GalleryCarousel';
import EditableGalleryCarousel, { type Gallery, type CarouselPhoto } from '../components/EditableGalleryCarousel';
import { fetchUserGallery, retrieveImageURL } from '../services/photoService';
import { useAuth } from '../contexts/AuthContext';

export default function GalleryPage() {
    const { user, loading } = useAuth();
    const [userGallery, setUserGallery] = React.useState<(Gallery & { photos: CarouselPhoto[] }) | null>(null);

    React.useEffect(() => {
        if (!user) {
            setUserGallery(null);
            return;
        }

        const loadGallery = async () => {
            try {
                const fetchedUser = await fetchUserGallery(user.$id);
                const fetchedGallery = fetchedUser?.gallery?.[0]; // fetchUserGallery returns the User object, so we need its first gallery
                if (fetchedGallery && fetchedGallery.photos && fetchedGallery.photos.length > 0) {
                    const mappedPhotos = fetchedGallery.photos.map((photo: any) => ({
                        id: photo.$id,
                        src: retrieveImageURL(photo.imageId, 1200),
                        title: photo.title || 'Untitled',
                        description: photo.description,
                        metadata: {
                            exposure: photo.exposure || 'N/A',
                            iso: photo.iso || 'N/A',
                            lens: photo.lens || 'N/A'
                        }
                    }));

                    setUserGallery({
                        id: fetchedGallery.$id,
                        title: fetchedGallery.galleryTitle || "Untitled Exhibition",
                        userId: user.$id,
                        photos: mappedPhotos as any
                    });
                }
            } catch (error) {
                console.error("Failed to load user gallery:", error);
            }
        };
        loadGallery();
    }, [user]);

    if (loading) return null;

    return (
        <>
            {!user && <GalleryCarousel />}
            {user && userGallery && <GalleryCarousel gallery={userGallery} authorName={user.name || 'You'} />}
            <EditableGalleryCarousel />
        </>
    );
}
