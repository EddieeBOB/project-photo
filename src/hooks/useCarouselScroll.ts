import * as React from 'react';

/**
 * Drives a horizontally scroll-snapping carousel.
 *
 * The scroll container is the source of truth: `activeIndex` is derived from
 * whichever child sits closest to the viewport centre, so dragging, a flung
 * swipe, and the arrow buttons all converge on the same answer.
 *
 * Attach the returned `scrollRef` and `onScroll` to the scrolling element:
 *
 * ```tsx
 * const { scrollRef, activeIndex, goPrev, goNext, onScroll } = useCarouselScroll();
 * <Box ref={scrollRef} onScroll={onScroll}>{cards}</Box>
 * ```
 */
export function useCarouselScroll() {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = React.useState(0);
    /** Coalesces the scroll handler down to one measurement per frame. */
    const measureRaf = React.useRef<number>(0);

    /** Smoothly centres the card at `index`, clamped to the ones that exist. */
    const scrollToIndex = React.useCallback((index: number) => {
        const container = scrollRef.current;
        if (!container) return;

        const cards = Array.from(container.children) as HTMLElement[];
        const target = cards[Math.min(Math.max(index, 0), cards.length - 1)];
        if (!target) return;

        const centredLeft = target.offsetLeft + target.offsetWidth / 2 - container.clientWidth / 2;
        container.scrollTo({ left: centredLeft, behavior: 'smooth' });
    }, []);

    const goPrev = React.useCallback(() => scrollToIndex(activeIndex - 1), [activeIndex, scrollToIndex]);
    const goNext = React.useCallback(() => scrollToIndex(activeIndex + 1), [activeIndex, scrollToIndex]);

    /** Jumps back to the first card — used after the deck itself changes. */
    const resetToStart = React.useCallback(() => {
        setActiveIndex(0);
        scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    }, []);

    const onScroll = React.useCallback(() => {
        cancelAnimationFrame(measureRaf.current);
        measureRaf.current = requestAnimationFrame(() => {
            const container = scrollRef.current;
            if (!container) return;

            const cards = Array.from(container.children) as HTMLElement[];
            if (cards.length === 0) return;

            const viewportCentre = container.scrollLeft + container.clientWidth / 2;
            let closestIndex = 0;
            let minDistance = Infinity;

            cards.forEach((card, index) => {
                const cardCentre = card.offsetLeft + card.offsetWidth / 2;
                const distance = Math.abs(cardCentre - viewportCentre);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                }
            });

            setActiveIndex(closestIndex);
        });
    }, []);

    // Drop any frame still queued when the carousel unmounts.
    React.useEffect(() => () => cancelAnimationFrame(measureRaf.current), []);

    return { scrollRef, activeIndex, setActiveIndex, goPrev, goNext, resetToStart, onScroll };
}
