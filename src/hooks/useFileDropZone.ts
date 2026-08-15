import * as React from 'react';

/**
 * Turns any element into a drop target for files.
 *
 * Spread `dropZoneProps` onto the element and use `isDraggingOver` to render
 * the drop affordance:
 *
 * ```tsx
 * const { isDraggingOver, dropZoneProps } = useFileDropZone(handleFiles);
 * <Box {...dropZoneProps}>{isDraggingOver && <DropOverlay />}</Box>
 * ```
 */
export function useFileDropZone(onFiles: (files: File[]) => void) {
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    /**
     * `dragenter`/`dragleave` fire for every descendant the pointer crosses, so
     * a plain boolean would flicker off as the cursor moves between children.
     * Counting enters against leaves means only the outermost leave clears it.
     */
    const enterCount = React.useRef(0);

    const onDragEnter = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        enterCount.current++;
        if (event.dataTransfer.items?.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const onDragLeave = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        enterCount.current--;
        if (enterCount.current === 0) {
            setIsDraggingOver(false);
        }
    };

    // Without preventDefault the browser navigates to the dropped file instead.
    const onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
        enterCount.current = 0;

        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(files);
    };

    return {
        isDraggingOver,
        dropZoneProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
    };
}
