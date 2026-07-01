import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import AuthLayout from '../components/AuthLayout';
import { confirmVerification } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography, PrimaryButton } from '../theme';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
    const [params] = useSearchParams();
    const { user, checkAuth } = useAuth();
    const [status, setStatus] = React.useState<Status>('verifying');

    React.useEffect(() => {
        const userId = params.get('userId');
        const secret = params.get('secret');
        if (!userId || !secret) {
            setStatus('error');
            return;
        }
        let active = true;
        (async () => {
            try {
                await confirmVerification(userId, secret);
                if (!active) return;
                await checkAuth();
                if (active) setStatus('success');
            } catch {
                if (active) setStatus('error');
            }
        })();
        return () => { active = false; };
    }, [params, checkAuth]);

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