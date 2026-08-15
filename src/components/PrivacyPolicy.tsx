import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { colors, typography } from '../theme';
import { PRIVACY_HTML } from '../content/privacyPolicyHtml';

interface PrivacyPolicyProps {
    /** Supplied when shown in the footer's dialog; omitted on a full page. */
    onClose?: () => void;
}

/**
 * Renders the privacy policy.
 *
 * The markup itself is vendor-generated and carries no classes worth targeting,
 * so it is restyled to match the site by scoping element selectors to this
 * wrapper rather than by editing the source HTML.
 */
export default function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
    return (
        <Container maxWidth="md" sx={{ py: onClose ? 4 : 8, px: { xs: 3, md: 4 }, position: 'relative' }}>
            {onClose && (
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'sticky',
                        top: 24,
                        float: 'right',
                        zIndex: 10,
                        color: colors.text,
                        backgroundColor: colors.hoverOverlay,
                        borderRadius: '0px',
                        border: `1px solid ${colors.borderLight}`,
                        transition: 'background-color 0.2s ease, color 0.2s ease',
                        '&:hover': {
                            backgroundColor: colors.text,
                            color: colors.onPrimary,
                        }
                    }}
                    aria-label="Close privacy policy"
                >
                    <CloseRoundedIcon />
                </IconButton>
            )}
            <Box
                sx={{
                    color: colors.text,
                    fontFamily: typography.ui,
                    '& h1': {
                        fontFamily: typography.headline,
                        fontSize: { xs: '2.5rem', md: '3.5rem' },
                        fontWeight: 400,
                        letterSpacing: '-0.02em',
                        mb: 4,
                        textAlign: 'left',
                        textTransform: 'uppercase',
                    },
                    '& h2': {
                        fontFamily: typography.headline,
                        fontSize: { xs: '1.5rem', md: '1.75rem' },
                        fontWeight: 400,
                        mt: 6,
                        mb: 3,
                        pb: 1,
                        borderBottom: `1px solid ${colors.borderLight}`,
                        textTransform: 'uppercase',
                    },
                    '& h3': {
                        fontFamily: typography.headline,
                        fontSize: { xs: '1.15rem', md: '1.25rem' },
                        fontWeight: 400,
                        mt: 4,
                        mb: 2,
                    },
                    '& p, & div, & span': {
                        fontFamily: typography.ui,
                        fontSize: '15px',
                        lineHeight: 1.7,
                        color: colors.textSecondary,
                        mb: 2,
                    },
                    '& ul': {
                        pl: 3,
                        mb: 3,
                    },
                    '& li': {
                        fontFamily: typography.ui,
                        fontSize: '15px',
                        lineHeight: 1.7,
                        color: colors.textSecondary,
                        mb: 1.5,
                    },
                    '& a': {
                        color: colors.text,
                        textDecoration: 'underline',
                        transition: 'color 0.2s ease',
                        '&:hover': {
                            color: colors.textSecondary,
                        }
                    },
                    '& strong': {
                        color: colors.text,
                        fontWeight: 600,
                    }
                }}
                dangerouslySetInnerHTML={{ __html: PRIVACY_HTML }}
            />
        </Container>
    );
}
