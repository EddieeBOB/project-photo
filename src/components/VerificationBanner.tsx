import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '../contexts/AuthContext';
import { sendVerificationEmail } from '../services/authService';
import { colors, typography } from '../theme';

/**
 * Soft verification reminder shown to logged-in users whose email is not yet
 * verified. Non-blocking — the app remains fully usable.
 */
export default function VerificationBanner() {
    const { user } = useAuth();
    const [sent, setSent] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    if (!user || user.emailVerification) return null;

    const handleResend = async () => {
        setBusy(true);
        try {
            await sendVerificationEmail();
            setSent(true);
        } catch {
            // Surface nothing intrusive here; the account page has full feedback.
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1200,
                backgroundColor: colors.surfaceBright,
                borderTop: `1px solid ${colors.borderLight}`,
                boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
                px: { xs: 2, md: 4 },
                py: 1.5,
                pb: 'calc(12px + env(safe-area-inset-bottom))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flexWrap: 'wrap',
            }}
        >
            <Typography sx={{ fontFamily: typography.ui, fontSize: '13px', color: colors.textSecondary }}>
                {sent ? 'Verification email sent — check your inbox.' : 'Please verify your email address to secure your account.'}
            </Typography>
            {!sent && (
                <Button
                    onClick={handleResend}
                    disableRipple
                    disabled={busy}
                    sx={{
                        fontFamily: typography.ui,
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: colors.text,
                        borderRadius: 0,
                        p: 0,
                        minWidth: 0,
                        textDecoration: 'underline',
                        '&:hover': { backgroundColor: 'transparent', color: colors.primary },
                    }}
                >
                    {busy ? 'Sending…' : 'Resend email'}
                </Button>
            )}
        </Box>
    );
}