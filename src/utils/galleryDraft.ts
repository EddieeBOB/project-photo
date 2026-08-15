import type { CarouselPhoto } from '../types/gallery';

/**
 * Limits on what the studio editor will submit. They mirror the column sizes
 * in Appwrite — catching an over-long title here turns a failed upload into an
 * inline message before anything is sent.
 */
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;

/** The id given to the trailing "add a photo" tile, which is not a real photo. */
export const DRAFT_PLACEHOLDER_ID = 'placeholder';

/** A blank trailing tile — the editor's affordance for adding more photos. */
export function createEmptyDraft(): CarouselPhoto {
    return {
        id: DRAFT_PLACEHOLDER_ID,
        src: '',
        title: '',
        description: '',
        metadata: { exposure: '', iso: '', lens: '' },
        isNew: true,
    };
}

/** Photos staged in the editor but not yet uploaded. */
export function unpublishedPhotos(items: CarouselPhoto[]): CarouselPhoto[] {
    return items.filter((item) => item.file);
}

/**
 * Checks a draft exhibition before publishing.
 *
 * @returns the first problem found, phrased for the user, or `null` if the
 *          draft is ready to upload.
 */
export function validateDraft(galleryTitle: string, items: CarouselPhoto[]): string | null {
    if (!galleryTitle.trim()) {
        return 'Please enter a gallery title.';
    }
    if (galleryTitle.length > MAX_TITLE_LENGTH) {
        return `Gallery title must be under ${MAX_TITLE_LENGTH} characters.`;
    }

    const pending = unpublishedPhotos(items);
    if (pending.length === 0) {
        return 'No new photos to publish.';
    }

    for (const photo of pending) {
        const title = photo.title?.trim() || '';
        if (title.length > MAX_TITLE_LENGTH) {
            return `Photo title "${title.substring(0, 20)}..." is too long (max ${MAX_TITLE_LENGTH} characters).`;
        }
        if ((photo.description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
            const subject = title ? `"${title}"` : 'this photo';
            return `Description for ${subject} is too long (max ${MAX_DESCRIPTION_LENGTH} characters).`;
        }
    }

    return null;
}
