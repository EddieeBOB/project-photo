import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { handleSignUp as handleSignUpService } from '../services/signupService';
import { setRememberPreference } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { getSignupPhoto } from '../services/imageUrls';
import PasswordRequirements from '../components/PasswordRequirements';
import AuthSideImage from '../components/AuthSideImage';
import Copyright from '../components/Copyright';
import Toast from '../components/Toast';
import { isPasswordValid } from '../utils/password';

import { colors, typography, PrimaryButton, StyledTextField } from '../theme';

export default function SignUp() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { checkAuth } = useAuth();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPasswordValid(password)) {
            setValidationError("Password does not meet the requirements.");
            return;
        }
        setValidationError(null);
        try {
            await handleSignUpService(username.trim(), email.trim(), password);
            // New signups are kept for the current browser session (no 30-day
            // "remember me"); this also marks the session active so the auth
            // gate in AuthContext doesn't immediately sign them back out.
            setRememberPreference(false);
            await checkAuth(); // Refresh global user state
            navigate('/studio'); // Redirect to studio workspace
        } catch (error) {
            setErrorMsg((error as Error).message || "Sign up failed. Please try again.");
        }
    };

    return (
        <Box sx={{ display: 'flex', flexGrow: 1, backgroundColor: colors.surface, height: '100vh'}}>
            <AuthSideImage src={getSignupPhoto()} />

            {/* Form */}
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
                        {t('signup.joinFrame')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            fontFamily: typography.ui,
                            color: colors.textSecondary,
                            mb: 6
                        }}
                    >
                        {t('signup.createAccount')}
                    </Typography>

                    <form onSubmit={handleSignUp}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <StyledTextField
                                fullWidth
                                label="Username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                spellCheck={false}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
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
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                slotProps={{ htmlInput: { minLength: 8 } }}
                                error={password.length > 0 && !isPasswordValid(password)}
                            />
                            <PasswordRequirements password={password} />
                            {validationError && (
                                <Alert severity="error" sx={{ borderRadius: '0px', fontFamily: typography.ui }}>
                                    {validationError}
                                </Alert>
                            )}
                            <PrimaryButton type="submit" fullWidth disableRipple sx={{ mt: 2 }}>
                                {t('nav.signUp')}
                            </PrimaryButton>
                        </Box>
                    </form>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                            {t('signup.alreadyHaveAccount')}{' '}
                            <Link to="/login" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                                {t('nav.logIn')}
                            </Link>
                        </Typography>
                    </Box>
                    <Copyright />
                </Box>
            </Box>

            <Toast message={errorMsg} onClose={() => setErrorMsg(null)} />
        </Box>
    );
}
