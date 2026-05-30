import { useState } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { handleLogin as handleLoginService } from '../services/loginService';
import { useAuth } from '../contexts/AuthContext';

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

export default function Login() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { checkAuth } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await handleLoginService(email, password);
            await checkAuth(); // Refresh global user state
            navigate('/studio'); // Redirect to studio workspace
        } catch (error: any) {
            setErrorMsg(error.message || "Login failed. Please try again.");
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
                        {t('login.welcomeBack')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            fontFamily: typography.ui,
                            color: colors.textSecondary,
                            mb: 6
                        }}
                    >
                        {t('login.enterDetails')}
                    </Typography>

                    <form onSubmit={handleLogin}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <StyledTextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <StyledTextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <PrimaryButton type="submit" fullWidth disableRipple sx={{ mt: 2 }}>
                                {t('login.logIn')}
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
                    src="/public/assets/login.jpg"
                    alt="Luminous Editorial Image"
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
        </Box>
    );
}
