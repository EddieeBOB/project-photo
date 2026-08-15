import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { colors, PrimaryButton } from '../../theme';

export interface UploadProgress {
    current: number;
    total: number;
}

interface PublishButtonProps {
    onClick: () => void;
    isPublishing: boolean;
    /** Per-photo progress, once the upload loop has started. */
    progress: UploadProgress | null;
}

/**
 * Publishes the draft exhibition.
 *
 * While uploading it doubles as the progress indicator: a translucent bar
 * fills the button from the left as each photo lands, since uploading a deck
 * of large images is slow enough that a bare spinner feels stalled.
 */
export default function PublishButton({ onClick, isPublishing, progress }: PublishButtonProps) {
    const percentComplete = progress && progress.total > 0
        ? (progress.current / progress.total) * 100
        : 0;

    return (
        <PrimaryButton
            onClick={onClick}
            disabled={isPublishing}
            sx={{
                height: 'fit-content',
                minWidth: '180px',
                position: 'relative',
                overflow: 'hidden',
                // Stays visually "live" rather than greying out mid-upload.
                '&.Mui-disabled': {
                    backgroundColor: colors.primary,
                    color: colors.onPrimary,
                    borderColor: colors.primary,
                    opacity: 0.85,
                },
            }}
        >
            {isPublishing ? (
                <>
                    {progress && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: `${percentComplete}%`,
                                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                zIndex: 1,
                            }}
                        />
                    )}
                    <Box sx={{ zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CircularProgress size={16} sx={{ color: 'inherit', mr: 1 }} />
                        <span>
                            {progress
                                ? `Publishing (${progress.current}/${progress.total})…`
                                : 'Publishing…'}
                        </span>
                    </Box>
                </>
            ) : (
                'Publish'
            )}
        </PrimaryButton>
    );
}
