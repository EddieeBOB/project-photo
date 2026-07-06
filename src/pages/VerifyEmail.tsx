import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import AuthLayout from '../components/AuthLayout';
import { confirmVerification } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography, PrimaryButton } from '../theme';

type Status = 'idle' | 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
    const [params] = useSearchParams();
    const { user, checkAuth } = useAuth();
    const userId = params.get('userId');
    const secret = params.get('secret');
    // Start 'idle' when we have a token so verification waits for an explicit
    // user click. Automated email link scanners (Gmail prefetch, Outlook/Defender
    // Safe Links, corporate AV) issue a GET on every link in the email and would
    // otherwise consume the one-time secret — verifying the account before the
    // real user ever clicks. A button gates the state-changing call behind a human.
    const [status, setStatus] = React.useState<Status>(userId && secret ? 'idle' : 'error');

    const handleVerify = React.useCallback(async () => {
        if (!userId || !secret) {
            setStatus('error');
            return;
        }
        setStatus('verifying');
        try {
            await confirmVerification(userId, secret);
            await checkAuth();
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }, [userId, secret, checkAuth]);

    if (status === 'idle') {
        return (
            <AuthLayout title="Verify your email" subtitle="Click below to confirm your email address.">
                <PrimaryButton fullWidth disableRipple onClick={handleVerify}>
                    Verify my email address
                </PrimaryButton>
            </AuthLayout>
        );
    }

    if (status === 'verifying') {
        return (
            <AuthLayout title="Verifying…">
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            </AuthLayout>
        );
    }

    if (status === 'success') {
        return (
            <AuthLayout title="Email Verified" subtitle="Your email address has been confirmed. Thank you!">
                <PrimaryButton fullWidth disableRipple {...({ component: Link, to: user ? '/account' : '/login' } as object)}>
                    {user ? 'Go to Account' : 'Continue to Login'}
                </PrimaryButton>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Verification Failed" subtitle="This verification link is invalid or has expired.">
            <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, mb: 4, lineHeight: 1.6 }}>
                Request a fresh verification email from your account page and try again.
            </Typography>
            <PrimaryButton fullWidth disableRipple {...({ component: Link, to: user ? '/account' : '/login' } as object)}>
                {user ? 'Go to Account' : 'Back to Login'}
            </PrimaryButton>
        </AuthLayout>
    );
}