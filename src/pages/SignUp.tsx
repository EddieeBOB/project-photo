import { useState } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { handleSignUp as handleSignUpService } from '../services/signupService';
import { useAuth } from '../contexts/AuthContext';
import { getSignupPhoto } from '../services/photoService';

import { colors, typography, PrimaryButton } from '../theme';

const StyledTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
        borderRadius: '0px',
        fontFamily: typography.ui,
        backgroundColor: colors.surfaceBright,
        '& fieldset': {
            borderColor: colors.borderLight,
        },
        '&:hover fieldset': {
            borderColor: colors.textSecondary,
        },
        '&.Mui-focused fieldset': {
            borderColor: colors.primary,
            borderWidth: '1px',
        },
    },
    '& .MuiInputLabel-root': {
        fontFamily: typography.ui,
        color: colors.textSecondary,
        '&.Mui-focused': {
            color: colors.primary,
        }
    }
});

export default function SignUp() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { checkAuth } = useAuth();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await handleSignUpService(username.trim(), email.trim(), password);
            await checkAuth(); // Refresh global user state
            navigate('/studio'); // Redirect to studio workspace
        } catch (error: any) {
            setErrorMsg(error.message || "Sign up failed. Please try again.");
        }
    };

    return (
        <Box sx={{ display: 'flex', flexGrow: 1, backgroundColor: colors.surface }}>
            {/* Left side: Image */}
            <Box sx={{
                flex: 1,
                display: { xs: 'none', md: 'block' },
                position: 'relative'
            }}>
                <img
                    src={getSignupPhoto()}
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

            {/* Right side: Form */}
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
                                helperText={password.length > 0 && password.length < 8 ? "Password must be at least 8 characters" : ""}
                                error={password.length > 0 && password.length < 8}
                            />
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
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            © {new Date().getFullYear()} Frame Collective.
                        </Typography>
                    </Box>
                </Box>
            </Box>
            <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg(null)}>
                <Alert onClose={() => setErrorMsg(null)} severity="error" sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}>
                    {errorMsg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
