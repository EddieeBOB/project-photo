import * as React from 'react';

/**
 * Frees a `blob:` preview URL. Anything else (a remote URL, or nothing) is
 * ignored, so callers don't have to check what kind of source they hold.
 */
export function revokeIfObjectUrl(src: string | undefined): void {
    if (src?.startsWith('blob:')) {
        URL.revokeObjectURL(src);
    }
}

/**
 * Releases the object URLs an editor created once it unmounts.
 *
 * `URL.createObjectURL` pins the whole file in memory until it is revoked, and
 * a photo can leave `items` in several ways (removed, published, navigated
 * away from). So rather than tracking each exit, every URL seen is remembered
 * and the whole set is released on unmount.
 */
export function useRevokeObjectUrls(items: { src?: string }[]): void {
    const seen = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        items.forEach((item) => {
            if (item.src?.startsWith('blob:')) seen.current.add(item.src);
        });
    }, [items]);

    React.useEffect(() => {
        const urls = seen.current;
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
        };
    }, []);
}
