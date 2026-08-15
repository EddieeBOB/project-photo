import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

import { colors } from '../../theme';

/**
 * Placeholder shown while a gallery loads. It mirrors the real carousel's
 * layout — one card, a header, a dot row — so the page doesn't jump when the
 * data arrives.
 */
export default function GalleryCarouselSkeleton({ disableHeaderPadding }: { disableHeaderPadding?: boolean }) {
    return (
        <Box
            sx={{
                pt: disableHeaderPadding ? { xs: 2, md: 2 } : { xs: 12, md: 12 },
                pb: { xs: 2, md: 0 },
                backgroundColor: colors.surface,
            }}
        >
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                {/* Exhibition number and title */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        mb: 3,
                        mt: disableHeaderPadding ? 0 : 5,
                    }}
                >
                    <Box sx={{ width: '100%', maxWidth: '400px' }}>
                        <Box className="skeleton" sx={{ width: '80px', height: '11px', mb: 1.5 }} />
                        <Box className="skeleton" sx={{ width: '100%', height: { xs: '36px', md: '48px' } }} />
                    </Box>
                </Box>

                {/* A single photo card */}
                <Box sx={{ display: 'flex', gap: 4, overflow: 'hidden', pb: 2 }}>
                    <Box
                        sx={{
                            minWidth: { xs: '100%', md: '85%' },
                            border: `1px solid ${colors.borderLight}`,
                            backgroundColor: colors.onPrimary,
                            p: { xs: 2, md: 3 },
                            display: 'flex',
                            flexDirection: 'column',
                            opacity: 0.8,
                        }}
                    >
                        <Box className="skeleton" sx={{ width: '100%', aspectRatio: { xs: '4/3', md: '16/9' }, mb: 3 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 3 }}>
                            {/* Title and author */}
                            <Box sx={{ flex: 1, maxWidth: '200px' }}>
                                <Box className="skeleton" sx={{ width: '80%', height: '24px', mb: 1 }} />
                                <Box className="skeleton" sx={{ width: '50%', height: '14px' }} />
                            </Box>

                            {/* Exposure / ISO / lens */}
                            <Box sx={{ display: 'flex', gap: { xs: 2, md: 3 }, borderLeft: `1px solid ${colors.borderLight}`, pl: { xs: 2, md: 3 } }}>
                                {[1, 2, 3].map((field) => (
                                    <Box key={field} sx={{ width: '60px' }}>
                                        <Box className="skeleton" sx={{ width: '100%', height: '10px', mb: 1 }} />
                                        <Box className="skeleton" sx={{ width: '80%', height: '14px' }} />
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Progress dashes */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
                    {[1, 2, 3].map((dash) => (
                        <Box key={dash} className="skeleton" sx={{ height: '1px', width: '40px' }} />
                    ))}
                </Box>
            </Container>
        </Box>
    );
}
