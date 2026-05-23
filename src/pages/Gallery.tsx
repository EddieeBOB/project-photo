import * as React from 'react';
import GalleryCarousel from '../components/GalleryCarousel';
import EditableGalleryCarousel, { type CarouselItem } from '../components/EditableGalleryCarousel';

const initialItems: CarouselItem[] = [
    {
        id: 1,
        src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Void and Structure',
        author: 'Julian Vossen',
        metadata: {
            exposure: '1/125 · f/8.0',
            iso: '100',
            lens: '35mm'
        }
    },
    {
        id: 2,
        src: 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Organic Tension',
        author: 'Elena Rossi',
        metadata: {
            exposure: '1/250 · f/5.6',
            iso: '400',
            lens: '50mm'
        }
    },
    {
        id: 3,
        src: 'https://images.unsplash.com/photo-1506744626753-1fa30fd200ab?auto=format&fit=crop&q=80&w=1200&h=800',
        title: 'Silent Geometry',
        author: 'Marcus Lin',
        metadata: {
            exposure: '1/500 · f/2.8',
            iso: '100',
            lens: '85mm'
        }
    }
];

export default function Gallery() {
    const [items] = React.useState<CarouselItem[]>(initialItems);

    return (
        <>
            <GalleryCarousel items={items} />
            <EditableGalleryCarousel />
        </>
    );
}
