import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';

import { useFileDropZone } from '../hooks/useFileDropZone';
import { colors, SecondaryButton, typography } from '../theme';
import type { Provenance, ProvenanceState } from '../types/provenance';
import { UploadIcon } from './icons';

interface VerifyPhotoDialogProps {
    open: boolean;
    onClose: () => void;
}

/** Headline and explanation for each outcome, in the visitor's terms. */
const RESULTS: Record<ProvenanceState, { headline: string; detail: string }> = {
    registered: {
        headline: 'Registered',
        detail: 'These exact bytes were published on photoframes.me, and have not changed since. The registry records only that — who published it, and what they called it, are shown on the photo itself.',
    },
    unregistered: {
        headline: 'Not in the registry',
        detail: 'No record matches this file. Either it was never published here, or it has been edited, re-encoded, or re-saved since — a registry records one exact sequence of bytes, so it cannot tell those apart.',
    },
    error: {
        headline: 'Could not check this file',
        detail: 'The registry could not be reached. This says nothing about the photo — try again in a moment.',
    },
};

/**
 * Lets anyone check a photo against the provenance registry.
 *
 * The photo stays on the visitor's machine; what leaves is a SHA-256 of its
 * bytes, which the registry is queried for. The dialog says this plainly
 * rather than claiming nothing is sent, because asking someone to hand over a
 * photo to prove a point about trust deserves an honest answer up front.
 */
export default function VerifyPhotoDialog({ open, onClose }: VerifyPhotoDialogProps) {
    const [result, setResult] = useState<Provenance | null>(null);
    const [isReading, setIsReading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function verify(files: File[]) {
        const file = files[0];
        if (!file) return;

        setIsReading(true);
        setResult(null);
        try {
            // Imported here so the dialog's code only loads for the visitors
            // who actually open it.
            const { verifyFile } = await import('../services/provenanceVerify');
            setResult(await verifyFile(file));
        } finally {
            setIsReading(false);
        }
    }

    const { isDraggingOver, dropZoneProps } = useFileDropZone(verify);

    function reset() {
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    }

    function close() {
        reset();
        onClose();
    }

    return (
        <Dialog
            open={open}
            onClose={close}
            maxWidth="sm"
            fullWidth
            slotProps={{ paper: { sx: { borderRadius: 0, backgroundColor: colors.surfaceBright } } }}
        >
            <Box sx={{ p: { xs: 3, md: 5 } }}>
                <Typography
                    variant="h3"
                    sx={{
                        fontFamily: typography.headline,
                        fontSize: '24px',
                        fontWeight: 400,
                        color: colors.text,
                        mb: 1,
                    }}
                >
                    Verify a photo
                </Typography>
                <Typography
                    sx={{
                        fontFamily: typography.ui,
                        fontSize: '14px',
                        color: colors.textSecondary,
                        lineHeight: 1.6,
                        mb: 3,
                    }}
                >
                    Check whether a photo was published here, and whether it has changed
                    since. The photo stays on your device — only its fingerprint is sent.
                </Typography>

                {result ? (
                    <Result provenance={result} onReset={reset} />
                ) : (
                    <Box
                        {...dropZoneProps}
                        component="button"
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={isReading}
                        sx={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1.5,
                            py: 6,
                            px: 3,
                            cursor: isReading ? 'default' : 'pointer',
                            font: 'inherit',
                            color: colors.text,
                            border: `2px dashed ${isDraggingOver ? colors.text : colors.borderLight}`,
                            backgroundColor: isDraggingOver ? colors.hoverOverlay : 'transparent',
                            '@media (prefers-reduced-motion: no-preference)': {
                                transition: 'border-color 0.2s ease, background-color 0.2s ease',
                            },
                            '&:hover:not(:disabled)': { borderColor: colors.text },
                            '&:focus-visible': { outline: `2px solid ${colors.text}`, outlineOffset: '2px' },
                        }}
                    >
                        {isReading ? (
                            <>
                                <CircularProgress size={24} sx={{ color: colors.text }} />
                                <Typography sx={{ fontFamily: typography.ui, fontSize: '14px' }}>
                                    Checking the registry…
                                </Typography>
                            </>
                        ) : (
                            <>
                                <UploadIcon />
                                <Typography sx={{ fontFamily: typography.ui, fontSize: '15px' }}>
                                    Drag a photo here, or click to choose one
                                </Typography>
                                <Typography
                                    sx={{
                                        fontFamily: typography.ui,
                                        fontSize: '13px',
                                        color: colors.textSecondary,
                                    }}
                                >
                                    JPEG, PNG, WebP, AVIF
                                </Typography>
                            </>
                        )}
                    </Box>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => verify(Array.from(event.target.files ?? []))}
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                    <SecondaryButton onClick={close}>Close</SecondaryButton>
                </Box>
            </Box>
        </Dialog>
    );
}

/** One labelled line of registry detail. */
function Field({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Typography
                sx={{
                    fontFamily: typography.ui,
                    fontSize: '11px',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    minWidth: '84px',
                    pt: '2px',
                }}
            >
                {label}
            </Typography>
            <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.text }}>
                {value}
            </Typography>
        </Box>
    );
}

function Result({ provenance, onReset }: { provenance: Provenance; onReset: () => void }) {
    const { headline, detail } = RESULTS[provenance.state];

    return (
        <Box sx={{ border: `1px solid ${colors.borderLight}`, p: 3 }}>
            <Typography
                sx={{
                    fontFamily: typography.headline,
                    fontSize: '20px',
                    color: colors.text,
                    mb: 1,
                }}
            >
                {headline}
            </Typography>
            <Typography
                sx={{
                    fontFamily: typography.ui,
                    fontSize: '14px',
                    color: colors.textSecondary,
                    lineHeight: 1.6,
                    mb: provenance.registeredAt ? 3 : 0,
                }}
            >
                {detail}
            </Typography>

            {provenance.registeredAt && (
                <Field label="Registered" value={new Date(provenance.registeredAt).toLocaleString()} />
            )}

            <Box sx={{ mt: 3 }}>
                <SecondaryButton onClick={onReset}>Check another</SecondaryButton>
            </Box>
        </Box>
    );
}
