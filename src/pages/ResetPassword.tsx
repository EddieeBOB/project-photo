import { useState } from 'react';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordValid } from '../utils/password';
import { confirmPasswordReset } from '../services/authService';
import { PrimaryButton, SecondaryButton, StyledTextField } from '../theme';

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const userId = params.get('userId');
    const secret = params.get('secret');

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const linkValid = Boolean(userId && secret);
    const mismatch = confirm.length > 0 && password !== confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !secret) return;
        if (!isPasswordValid(password)) {
            setErrorMsg('Password does not meet the requirements.');
            return;
        }
        if (password !== confirm) {
            setErrorMsg('Passwords do not match.');
            return;
        }
        setSubmitting(true);
        try {
            await confirmPasswordReset(userId, secret, password);
            setDone(true);
        } catch (error: any) {
            setErrorMsg(error.message || 'Could not reset your password. The link may have expired.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!linkValid) {
        return (
            <AuthLayout title="Invalid Link" subtitle="This password-reset link is missing required information or has expired.">
                <PrimaryButton fullWidth disableRipple {...({ component: Link, to: '/forgot-password' } as object)}>
                    Request a New Link
                </PrimaryButton>
            </AuthLayout>
        );
    }

    if (done) {
        return (
            <AuthLayout title="Password Updated" subtitle="Your password has been changed. You can now log in with your new password.">
                <PrimaryButton fullWidth disableRipple onClick={() => navigate('/login')}>
                    Go to Login
                </PrimaryButton>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Set a New Password" subtitle="Choose a new password for your account.">
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <StyledTextField
                        fullWidth
                        label="New password"
                        type="password"
                        name="new-password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        slotProps={{ htmlInput: { minLength: 8 } }}
                        error={password.length > 0 && !isPasswordValid(password)}
                    />
                    <PasswordRequirements password={password} />
                    <StyledTextField
                        fullWidth
                        label="Confirm password"
                        type="password"
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        helperText={mismatch ? 'Passwords do not match' : ''}
                        error={mismatch}
                    />
                    <PrimaryButton type="submit" fullWidth disableRipple disabled={submitting || !isPasswordValid(password) || password !== confirm} sx={{ mt: 1 }}>
                        {submitting ? 'Updating…' : 'Update Password'}
                    </PrimaryButton>
                    <SecondaryButton fullWidth disableRipple {...({ component: Link, to: '/login' } as object)}>
                        Cancel
                    </SecondaryButton>
                </Box>
            </form>
            <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)}>
                <Alert onClose={() => setErrorMsg(null)} severity="error" sx={{ width: '100%', borderRadius: '0px', fontFamily: 'Inter, sans-serif' }}>
                    {errorMsg}
                </Alert>
            </Snackbar>
        </AuthLayout>
    );
}