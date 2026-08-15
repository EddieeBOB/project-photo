import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { handleLogin as handleLoginService } from '../services/loginService';
import { startEmailMfaChallenge, completeMfaChallenge, abortPartialSession, setRememberPreference } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { getLoginPhoto } from '../services/imageUrls';
import AuthSideImage from '../components/AuthSideImage';
import Copyright from '../components/Copyright';
import Toast from '../components/Toast';
import { colors, typography, PrimaryButton, SecondaryButton, StyledTextField } from '../theme';

/**
 * `password` collects the credentials; `mfa` collects the emailed one-time
 * code. Accounts without two-factor enabled never reach the second step.
 */
type Step = 'password' | 'mfa';

export default function Login() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { checkAuth } = useAuth();

    const [step, setStep] = useState<Step>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);

    /** Records the session's lifetime, refreshes auth state, and lands in the studio. */
    const finishLogin = async () => {
        setRememberPreference(rememberMe);
        await checkAuth();
        navigate('/studio');
    };

    const handleSubmitCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { mfaRequired } = await handleLoginService(email.trim(), password);
            if (mfaRequired) {
                setChallengeId(await startEmailMfaChallenge());
                setStep('mfa');
                setInfoMsg('We sent a verification code to your email.');
            } else {
                await finishLogin();
            }
        } catch (error) {
            setErrorMsg((error as Error).message || 'Login failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!challengeId) return;
        setSubmitting(true);
        try {
            await completeMfaChallenge(challengeId, otp.trim());
            await finishLogin();
        } catch (error) {
            setErrorMsg((error as Error).message || 'Invalid code. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    /** Backing out of the code step also discards the half-open session. */
    const cancelMfa = () => {
        abortPartialSession();
        setChallengeId(null);
        setStep('password');
        setOtp('');
    };

    const isMfaStep = step === 'mfa';

    return (
        <Box sx={{ display: 'flex', flexGrow: 1, backgroundColor: colors.surface }}>
            <Box sx={{
                flex: 1,
                display: 'flex',
                height: '100vh',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: { xs: 4, md: 8 },
                pt: { xs: 16, md: 8 }, // Clear the fixed navbar
            }}>
                <Box sx={{ width: '100%', maxWidth: '400px' }}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '32px', md: '48px' },
                            color: colors.text,
                            mb: 2,
                        }}
                    >
                        {isMfaStep ? 'Verify It’s You' : t('login.welcomeBack')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{ fontFamily: typography.ui, color: colors.textSecondary, mb: 6 }}
                    >
                        {isMfaStep ? 'Enter the 6-digit code we emailed you.' : t('login.enterDetails')}
                    </Typography>

                    {isMfaStep ? (
                        <form onSubmit={handleSubmitOtp}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <StyledTextField
                                    fullWidth
                                    label="Verification code"
                                    type="text"
                                    name="one-time-code"
                                    autoComplete="one-time-code"
                                    inputMode="numeric"
                                    spellCheck={false}
                                    autoFocus
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                />
                                <PrimaryButton type="submit" fullWidth disableRipple disabled={submitting} sx={{ mt: 2 }}>
                                    {submitting ? 'Verifying…' : 'Verify & Continue'}
                                </PrimaryButton>
                                <SecondaryButton fullWidth disableRipple onClick={cancelMfa}>
                                    Cancel
                                </SecondaryButton>
                            </Box>
                        </form>
                    ) : (
                        <>
                            <form onSubmit={handleSubmitCredentials}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <StyledTextField
                                        fullWidth
                                        label="Email or username"
                                        type="text"
                                        name="identifier"
                                        autoComplete="username"
                                        spellCheck={false}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                    <StyledTextField
                                        fullWidth
                                        label="Password"
                                        type="password"
                                        name="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -1 }}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                    disableRipple
                                                    size="small"
                                                    sx={{ color: colors.textSecondary, '&.Mui-checked': { color: colors.primary } }}
                                                />
                                            }
                                            label="Remember me for 30 days"
                                            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontFamily: typography.ui, fontSize: '13px', color: colors.textSecondary } }}
                                        />
                                        <Link to="/forgot-password" style={{ color: colors.textSecondary, textDecoration: 'none', fontFamily: typography.ui, fontSize: '13px' }}>
                                            Forgot password?
                                        </Link>
                                    </Box>
                                    <PrimaryButton type="submit" fullWidth disableRipple disabled={submitting} sx={{ mt: 1 }}>
                                        {submitting ? 'Signing in…' : t('login.logIn')}
                                    </PrimaryButton>
                                </Box>
                            </form>

                            <Box sx={{ mt: 4, textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                                    {t('login.noAccount')}{' '}
                                    <Link to="/signup" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                                        {t('login.signUp')}
                                    </Link>
                                </Typography>
                            </Box>
                        </>
                    )}

                    <Copyright />
                </Box>
            </Box>

            <AuthSideImage src={getLoginPhoto()} />

            <Toast message={errorMsg} onClose={() => setErrorMsg(null)} />
            <Toast message={infoMsg} severity="info" onClose={() => setInfoMsg(null)} />
        </Box>
    );
}
