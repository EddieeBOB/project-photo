import type { GalleryWithPhotos } from '../types/gallery';

/**
 * Marks the stand-in deck below. Cards carrying this id are not owned by
 * anyone, so the carousel hides its edit controls for them.
 */
export const DEMO_GALLERY_ID = 'default';

/**
 * The exhibition shown to visitors who have nothing of their own to display
 * yet — a signed-out landing on /gallery, or a preview with no data behind it.
 * Images are hotlinked from Unsplash rather than stored in our bucket.
 */
export const demoGallery: GalleryWithPhotos = {
    id: DEMO_GALLERY_ID,
    title: 'The Silent Architecture of Light',
    userId: 'system',
    photos: [
        {
            id: '1',
            title: 'Void and Structure',
            description: '',
            src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/125 · f/8.0', iso: '100', lens: '35mm' },
        },
        {
            id: '2',
            title: 'Organic Tension',
            description: '',
            src: 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/250 · f/5.6', iso: '400', lens: '50mm' },
        },
        {
            id: '3',
            title: 'Silent Geometry',
            description: '',
            src: 'https://images.unsplash.com/photo-1506744626753-1fa30fd200ab?auto=format&fit=crop&q=80&w=1200&h=800',
            metadata: { exposure: '1/500 · f/2.8', iso: '100', lens: '85mm' },
        },
    ],
};
