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
    trusted: {
        headline: 'Signed and verified',
        detail: 'The signature is intact and its certificate is issued by a recognised authority. This photo has not been altered since it was signed.',
    },
    signed: {
        headline: 'Signed',
        detail: 'The signature is intact and the photo has not been altered since it was signed. The certificate is not issued by a recognised authority, so the signer is self-attested.',
    },
    modified: {
        headline: 'Modified since signing',
        detail: 'This photo carries Content Credentials, but its pixels no longer match what was signed. It has been edited, re-encoded, or re-saved since.',
    },
    none: {
        headline: 'No Content Credentials',
        detail: 'This photo carries no provenance information. That is the ordinary case for most photos on the web — it says nothing bad about the image, only that nothing was recorded.',
    },
    error: {
        headline: 'Could not read this file',
        detail: 'The file could not be parsed as an image. Try a JPEG, PNG, or WebP.',
    },
};

/**
 * Lets anyone check a photo's Content Credentials.
 *
 * The file never leaves the browser — the reader is WebAssembly and parses the
 * bytes in place — which the dialog says out loud, because asking someone to
 * hand over a photo to prove a point about trust deserves an answer up front.
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
            // Imported here so the megabyte of WebAssembly only loads for the
            // visitors who actually open this dialog.
            const { verifyFile } = await import('../services/c2paVerify');
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
                    Check whether a photo carries Content Credentials, and whether it has been
                    altered since. The file is read in your browser — nothing is uploaded.
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
                                    Reading credentials…
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

/** One labelled line of manifest detail. */
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
    // Only a broken binding is a warning. An unsigned photo is simply unsigned,
    // and colouring it red would imply an accusation the manifest never makes.
    const isWarning = provenance.state === 'modified';

    return (
        <Box sx={{ border: `1px solid ${colors.borderLight}`, p: 3 }}>
            <Typography
                sx={{
                    fontFamily: typography.headline,
                    fontSize: '20px',
                    color: isWarning ? colors.danger : colors.text,
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
                    mb: provenance.creator || provenance.signedBy ? 3 : 0,
                }}
            >
                {detail}
            </Typography>

            {provenance.creator && <Field label="Creator" value={provenance.creator} />}
            {provenance.signedBy && <Field label="Signed by" value={provenance.signedBy} />}
            {provenance.issuer && <Field label="Certificate" value={provenance.issuer} />}
            {provenance.signedAt && (
                <Field label="Signed" value={new Date(provenance.signedAt).toLocaleString()} />
            )}

            <Box sx={{ mt: 3 }}>
                <SecondaryButton onClick={onReset}>Check another</SecondaryButton>
            </Box>
        </Box>
    );
}
