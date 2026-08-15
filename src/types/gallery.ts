/**
 * The shapes shared by the gallery UI and the services that load/save it.
 *
 * These live outside the component tree on purpose: the service layer needs
 * them too, and importing types from a component would make `services/` depend
 * on `components/`.
 */

/** A single photograph, as stored in the `photos` table. */
export interface Photo {
    id: string;
    title: string;
    description: string;
    metadata: {
        exposure: string;
        iso: string;
        lens: string;
    };
    /** Present only for a photo picked in the browser but not yet uploaded. */
    file?: File;
}

/** A collection of photographs owned by one user. */
export interface Gallery {
    id: string;
    title: string;
    userId: string;
    photos: Photo[];
    isPublic?: boolean;
}

/**
 * A photo as the carousels render it.
 *
 * `src` is either a remote preview URL (already published) or a local `blob:`
 * URL (staged in the editor). `isNew` marks the trailing "add a photo" tile,
 * which is a placeholder rather than a real photo.
 */
export type CarouselPhoto = Photo & {
    src?: string;
    isNew?: boolean;
};

/**
 * A gallery whose photos are ready to render.
 *
 * `photos` is replaced rather than intersected: `Photo[] & CarouselPhoto[]`
 * would still hand back plain `Photo` on access, forcing a cast at every use.
 */
export type GalleryWithPhotos = Omit<Gallery, 'photos'> & { photos: CarouselPhoto[] };
