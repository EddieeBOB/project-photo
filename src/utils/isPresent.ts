/**
 * Type guard for `.filter()` that drops `null`/`undefined` *and* narrows the
 * resulting array's type — which a bare `Boolean` filter does not do.
 *
 * ```ts
 * const galleries = rows.map(mapGalleryToCarousel).filter(isPresent);
 * ```
 */
export function isPresent<T>(value: T | null | undefined): value is T {
    return value != null;
}
