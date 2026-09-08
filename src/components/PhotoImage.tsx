import { useMemo, useState, type CSSProperties } from 'react';
import Box from '@mui/material/Box';

import { thumbhashToDataURL, thumbhashToAspectRatio } from '../lib/thumbhash';

export interface PhotoImageProps {
    /** Omitted leaves the attribute off entirely, rather than pointing at the page. */
    src?: string;
    alt: string;
    /** Base64 ThumbHash from the photo's row. Without one this renders a plain image. */
    thumbhash?: string;
    /**
     * Take the box's shape from the hash, so the photo's footprint is reserved
     * before it downloads. For containers that impose no ratio of their own —
     * the carousel deliberately crops to 4/3 and 16/9, and honouring the hash
     * there would fight it.
     */
    reserveSpace?: boolean;
    /** Intrinsic-size hints. Passed through to the underlying `<img>`. */
    width?: number;
    height?: number;
    loading?: 'eager' | 'lazy';
    fetchPriority?: 'high' | 'low' | 'auto';
    /** Applied to the wrapper, which fills its container by default. */
    style?: CSSProperties;
}

const FADE_IN = 'opacity 600ms ease';

/**
 * A photograph that fades up from its ThumbHash placeholder.
 *
 * The hash decodes locally and instantly, so the blurred impression is on
 * screen in the first paint while the real file is still in flight — the photo
 * resolves into place instead of snapping in over an empty grey box.
 *
 * The placeholder stays mounted underneath rather than being swapped out at
 * load: the image above it is opaque by the time the fade finishes, and
 * unmounting mid-transition would flash the background through.
 */
export default function PhotoImage({
    src,
    alt,
    thumbhash,
    reserveSpace,
    width,
    height,
    loading,
    fetchPriority,
    style,
}: PhotoImageProps) {
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

    const placeholder = useMemo(() => (thumbhash ? thumbhashToDataURL(thumbhash) : null), [thumbhash]);
    const aspectRatio = useMemo(() => {
        if (!reserveSpace || !thumbhash) return undefined;
        const ratio = thumbhashToAspectRatio(thumbhash);
        return ratio ? String(ratio) : undefined;
    }, [reserveSpace, thumbhash]);

    // Comparing against the src that finished, rather than a boolean, resets the
    // fade for free when the carousel swaps in a different photograph. A photo
    // with no source never resolves, so its placeholder simply stays put.
    const loaded = Boolean(src) && loadedSrc === src;
    const markLoaded = () => { if (src) setLoadedSrc(src); };

    return (
        <Box
            style={aspectRatio ? { aspectRatio, ...style } : style}
            sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        >
            {placeholder && (
                <Box
                    component="img"
                    src={placeholder}
                    alt=""
                    aria-hidden="true"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            )}
            <Box
                component="img"
                // A cached photo can finish before React attaches onLoad, which would
                // otherwise leave it stuck at opacity 0 behind the blur forever.
                ref={(img: HTMLImageElement | null) => {
                    if (img?.complete && img.naturalWidth > 0) markLoaded();
                }}
                src={src}
                alt={alt}
                width={width}
                height={height}
                loading={loading}
                fetchPriority={fetchPriority}
                // Deliberately no `crossorigin`: it puts the request in
                // anonymous credentials mode, which drops the Appwrite session
                // cookie on the cross-origin hop to the API. A photo readable
                // only by its owner then comes back 404 rather than 403 —
                // Appwrite filters unauthorised files out of existence — so the
                // whole gallery renders as empty boxes. Nothing here reads the
                // pixels back, so there is nothing to gain by tainting less.
                onLoad={markLoaded}
                // A photo that fails to load should look no different than it does
                // without a placeholder behind it.
                onError={markLoaded}
                sx={{
                    display: 'block',
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: placeholder && !loaded ? 0 : 1,
                    transition: FADE_IN,
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
            />
        </Box>
    );
}
