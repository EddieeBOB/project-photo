import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../components/AuthLayout';
import { completeMagicUrl } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { PrimaryButton } from '../theme';

type Status = 'loading' | 'error';

export default function MagicUrlCallback() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const [status, setStatus] = React.useState<Status>('loading');

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
                await completeMagicUrl(userId, secret);
                if (!active) return;
                await checkAuth();
                if (active) navigate('/studio', { replace: true });
            } catch {
                if (active) setStatus('error');
            }
        })();
        return () => { active = false; };
    }, [params, checkAuth, navigate]);

    if (status === 'error') {
        return (
            <AuthLayout title="Link Expired" subtitle="This magic sign-in link is invalid or has already been used.">
                <PrimaryButton fullWidth disableRipple {...({ component: Link, to: '/login' } as object)}>
                    Back to Login
                </PrimaryButton>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Signing you in…">
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        </AuthLayout>
    );
}