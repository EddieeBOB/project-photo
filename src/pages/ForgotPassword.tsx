import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import Toast from '../components/Toast';
import { sendPasswordReset } from '../services/authService';
import { colors, typography, PrimaryButton, SecondaryButton, StyledTextField } from '../theme';

/**
 * Requests a password-reset email.
 *
 * The confirmation is deliberately non-committal ("if an account exists") so
 * the page can't be used to check which email addresses are registered.
 */
export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await sendPasswordReset(email.trim());
            setSent(true);
        } catch (error) {
            setErrorMsg((error as Error).message || 'Could not send the reset email. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (sent) {
        return (
            <AuthLayout title="Check Your Email" subtitle={`If an account exists for ${email.trim()}, we've sent a password-reset link. It's valid for 1 hour.`}>
                <SecondaryButton fullWidth disableRipple {...({ component: Link, to: '/login' } as object)}>
                    Back to Login
                </SecondaryButton>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Reset Password" subtitle="Enter your account email and we'll send you a link to set a new password.">
            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <StyledTextField
                        fullWidth
                        label="Email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        inputMode="email"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <PrimaryButton type="submit" fullWidth disableRipple disabled={submitting} sx={{ mt: 1 }}>
                        {submitting ? 'Sending…' : 'Send Reset Link'}
                    </PrimaryButton>
                </Box>
            </form>
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                    Remembered it?{' '}
                    <Link to="/login" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                        Log in
                    </Link>
                </Typography>
            </Box>
            <Toast message={errorMsg} onClose={() => setErrorMsg(null)} />
        </AuthLayout>
    );
}