import { useState } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Link, useNavigate } from 'react-router-dom';
import { handleLogin as handleLoginService } from '../services/loginService';

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
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleLoginService(email, password, navigate);
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
                        Welcome Back.
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            fontFamily: typography.ui,
                            color: colors.textSecondary,
                            mb: 6
                        }}
                    >
                        Enter your details to access your gallery.
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
                                Log In
                            </PrimaryButton>
                        </Box>
                    </form>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ fontFamily: typography.ui, color: colors.textSecondary }}>
                            Don't have an account?{' '}
                            <Link to="/signup" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                                Sign Up
                            </Link>
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
                    src="https://tor.cloud.appwrite.io/v1/storage/buckets/6a0952c2001568b2f373/files/1/view?project=6a09504300328dac3255&mode=admin"
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
        </Box>
    );
}
