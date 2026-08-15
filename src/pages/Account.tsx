import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';

import { useAuth } from '../contexts/AuthContext';
import { sendVerificationEmail, setMfaEnabled } from '../services/authService';
import Toast from '../components/Toast';
import { colors, typography, PrimaryButton } from '../theme';

/** Small outlined badge reading e.g. "Verified" / "Unverified". */
function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-block',
                fontFamily: typography.ui,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                px: 1.5,
                py: 0.5,
                border: `1px solid ${ok ? colors.text : colors.borderLight}`,
                color: ok ? colors.text : colors.textSecondary,
            }}
        >
            {ok ? okLabel : badLabel}
        </Box>
    );
}

/** Shared card framing for each settings section. */
const sectionSx = {
    border: `1px solid ${colors.borderLight}`,
    backgroundColor: colors.surfaceBright,
    p: { xs: 3, md: 4 },
    mb: 3,
} as const;

/**
 * Profile and security settings.
 *
 * Two-factor authentication depends on a verified email — Appwrite delivers the
 * one-time code there — so its switch stays disabled until verification lands.
 */
export default function Account() {
    const { user, profile, checkAuth } = useAuth();
    const [busy, setBusy] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
    const [infoMsg, setInfoMsg] = React.useState<string | null>(null);

    const verified = Boolean(user?.emailVerification);
    const mfaEnabled = Boolean(user?.mfa);

    const handleResend = async () => {
        setBusy(true);
        try {
            await sendVerificationEmail();
            setInfoMsg('Verification email sent. Check your inbox.');
        } catch (error) {
            setErrorMsg((error as Error).message || 'Could not send the verification email.');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleMfa = async (enabled: boolean) => {
        setBusy(true);
        try {
            await setMfaEnabled(enabled);
            await checkAuth();
            setInfoMsg(enabled ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
        } catch (error) {
            setErrorMsg((error as Error).message || 'Could not update two-factor authentication.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ pt: { xs: 12, md: 16 }, pb: 8, backgroundColor: colors.surface, flexGrow: 1 }}>
            <Container maxWidth="md" sx={{ px: { xs: 3, md: 6 } }}>
                <Typography
                    variant="h1"
                    sx={{ fontFamily: typography.headline, fontSize: { xs: '32px', md: '48px' }, color: colors.text, mb: 1 }}
                >
                    Account
                </Typography>
                <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, mb: 5 }}>
                    Manage your profile and security settings.
                </Typography>

                {/* Profile */}
                <Box sx={sectionSx}>
                    <Typography sx={{ fontFamily: typography.headline, fontSize: '22px', color: colors.text, mb: 2 }}>
                        Profile
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, gap: 2, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>Username</Typography>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.text, fontWeight: 500 }}>
                            {profile?.username || user?.name || '—'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, gap: 2, flexWrap: 'wrap', wordBreak: 'break-all' }}>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>Email</Typography>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.text, fontWeight: 500 }}>
                            {user?.email}
                        </Typography>
                    </Box>
                </Box>

                {/* Email verification */}
                <Box sx={sectionSx}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontFamily: typography.headline, fontSize: '22px', color: colors.text }}>
                            Email Verification
                        </Typography>
                        <StatusPill ok={verified} okLabel="Verified" badLabel="Unverified" />
                    </Box>
                    <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6, mb: verified ? 0 : 3 }}>
                        {verified
                            ? 'Your email address is confirmed.'
                            : 'Verify your email to secure your account and enable two-factor authentication.'}
                    </Typography>
                    {!verified && (
                        <PrimaryButton disableRipple disabled={busy} onClick={handleResend}>
                            {busy ? 'Sending…' : 'Resend Verification Email'}
                        </PrimaryButton>
                    )}
                </Box>

                {/* Two-factor authentication */}
                <Box sx={sectionSx}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                            <Typography sx={{ fontFamily: typography.headline, fontSize: '22px', color: colors.text, mb: 0.5 }}>
                                Two-Factor Authentication
                            </Typography>
                            <Typography sx={{ fontFamily: typography.ui, fontSize: '14px', color: colors.textSecondary, lineHeight: 1.6, maxWidth: '460px' }}>
                                {verified
                                    ? 'When enabled, we email a one-time code at login for an extra layer of security.'
                                    : 'Verify your email address first to enable email-based two-factor authentication.'}
                            </Typography>
                        </Box>
                        <Switch
                            checked={mfaEnabled}
                            disabled={busy || !verified}
                            onChange={(e) => handleToggleMfa(e.target.checked)}
                            slotProps={{ input: { 'aria-label': 'Toggle two-factor authentication' } }}
                        />
                    </Box>
                </Box>
            </Container>

            <Toast message={errorMsg} onClose={() => setErrorMsg(null)} />
            <Toast message={infoMsg} severity="success" onClose={() => setInfoMsg(null)} />
        </Box>
    );
}