import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { handleLogin as handleLoginService } from '../services/loginService';
import { startEmailMfaChallenge, completeMfaChallenge, abortPartialSession, setRememberPreference } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { getLoginPhoto } from '../services/photoService';

import { colors, typography, PrimaryButton, SecondaryButton, StyledTextField } from '../theme';

type Mode = 'password' | 'mfa';

export default function Login() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('password');
    const [rememberMe, setRememberMe] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);
    const { checkAuth } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { mfaRequired } = await handleLoginService(email.trim(), password);
            if (mfaRequired) {
                const id = await startEmailMfaChallenge();
                setChallengeId(id);
                setMode('mfa');
                setInfoMsg('We sent a verification code to your email.');
            } else {
                setRememberPreference(rememberMe);
                await checkAuth();
                navigate('/studio');
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'Login failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyMfa = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!challengeId) return;
        setSubmitting(true);
        try {
            await completeMfaChallenge(challengeId, otp.trim());
            setRememberPreference(rememberMe);
            await checkAuth();
            navigate('/studio');
        } catch (error: any) {
            setErrorMsg(error.message || 'Invalid code. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexGrow: 1, backgroundColor: colors.surface }}>
            {/* Left side: Form */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: { xs: 4, md: 8 },
                pt: { xs: 16, md: 8 } // Account for fixed navbar
            }}>
                <Box sx={{ width: '100%', maxWidth: '400px' }}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontFamily: typography.headline,
                            fontSize: { xs: '32px', md: '48px' },
                            color: colors.text,
                            mb: 2
                        }}
                    >
                        {mode === 'mfa' ? 'Verify It’s You' : t('login.welcomeBack')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            fontFamily: typography.ui,
                            color: colors.textSecondary,
                            mb: 6
                        }}
                    >
                        {mode === 'mfa'
                            ? 'Enter the 6-digit code we emailed you.'
                            : t('login.enterDetails')}
                    </Typography>

                    {mode === 'mfa' ? (
                        <form onSubmit={handleVerifyMfa}>
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
                                <SecondaryButton fullWidth disableRipple onClick={() => { abortPartialSession(); setChallengeId(null); setMode('password'); setOtp(''); }}>
                                    Cancel
                                </SecondaryButton>
                            </Box>
                        </form>
                    ) : (
                        <>
                            <form onSubmit={handleLogin}>
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
                        </>
                    )}

                    {mode === 'password' && (
                        <Box sx={{ mt: 4, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                                {t('login.noAccount')}{' '}
                                <Link to="/signup" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                                    {t('login.signUp')}
                                </Link>
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            © {new Date().getFullYear()} Frame Collective.
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Right side: Image */}
            <Box sx={{
                flex: 1,
                display: { xs: 'none', md: 'block' },
                position: 'relative'
            }}>
                <img
                    src={getLoginPhoto()}
                    alt=""
                    width={1200}
                    height={1600}
                    loading="lazy"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            </Box>
            <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)}>
                <Alert onClose={() => setErrorMsg(null)} severity="error" sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}>
                    {errorMsg}
                </Alert>
            </Snackbar>
            <Snackbar open={!!infoMsg} autoHideDuration={6000} onClose={() => setInfoMsg(null)}>
                <Alert onClose={() => setInfoMsg(null)} severity="info" sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}>
                    {infoMsg}
                </Alert>
            </Snackbar>
        </Box>
    );
}