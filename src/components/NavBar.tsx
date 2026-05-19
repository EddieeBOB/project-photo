import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Drawer from '@mui/material/Drawer';
import MenuIcon from '@mui/icons-material/Menu';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';

import { colors, typography, PrimaryButton, SecondaryButton } from '../theme';

const StyledToolbar = styled(Toolbar)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: '0px',
    backdropFilter: 'blur(24px)', // backdrop-blur-xl
    border: `1px solid ${colors.borderLight}`,
    backgroundColor: colors.surfaceTransparent,
    padding: '12px 24px',
});

const NavButton = styled(Button)({
    color: colors.text,
    fontFamily: typography.ui,
    fontWeight: 400,
    fontSize: '14px', // Label Large
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    borderRadius: '0px',
    padding: '8px 16px',
    transition: 'all 0.3s ease-in-out',
    position: 'relative',
    overflow: 'hidden',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: '0px',
        left: '50%',
        width: '0%',
        height: '1px',
        backgroundColor: colors.primary,
        transition: 'all 0.3s ease',
        transform: 'translateX(-50%)',
    },
    '&:hover': {
        backgroundColor: 'transparent',
        color: colors.primary,
        '&::after': {
            width: '100%',
        }
    }
});

const navItems = ['Gallery', 'Exhibitions', 'Journal', 'About'];

export default function NavBar() {
    const [open, setOpen] = React.useState(false);
    const navigate = useNavigate();

    const toggleDrawer = (newOpen: boolean) => () => {
        setOpen(newOpen);
    };

    return (
        <AppBar
            position="fixed"
            sx={{
                boxShadow: 'none',
                bgcolor: 'transparent',
                backgroundImage: 'none',
            }}
        >
            <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 }, mt: { xs: 0, sm: 4 } }}>
                <StyledToolbar variant="regular" disableGutters>
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Typography
                            variant="h6"
                            onClick={() => navigate('/')}
                            sx={{
                                fontFamily: typography.headline,
                                color: colors.text,
                                fontSize: '24px',
                                letterSpacing: '0.02em',
                                cursor: 'pointer',
                            }}
                        >
                            Frame
                        </Typography>
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                            {navItems.map((item) => (
                                <NavButton key={item} disableRipple onClick={() => item === 'Gallery' ? navigate('/gallery') : undefined}>
                                    {item}
                                </NavButton>
                            ))}
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'flex' },
                            gap: 2,
                            alignItems: 'center',
                        }}
                    >
                        <SecondaryButton size="small" disableRipple onClick={() => navigate('/login')}>
                            Log In
                        </SecondaryButton>
                        <PrimaryButton size="small" disableRipple onClick={() => navigate('/signup')}>
                            Sign Up
                        </PrimaryButton>
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <IconButton aria-label="Menu button" onClick={toggleDrawer(true)} sx={{ color: colors.text }}>
                            <MenuIcon />
                        </IconButton>
                        <Drawer
                            anchor="top"
                            open={open}
                            onClose={toggleDrawer(false)}
                            sx={{
                                '& .MuiDrawer-paper': {
                                    backdropFilter: 'blur(24px)',
                                    backgroundColor: 'rgba(249, 249, 249, 0.95)',
                                    borderBottom: `1px solid ${colors.borderLight}`,
                                    borderRadius: '0px',
                                }
                            }}
                        >
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                                    <IconButton onClick={toggleDrawer(false)} sx={{ color: colors.text }}>
                                        <CloseRoundedIcon />
                                    </IconButton>
                                </Box>
                                {navItems.map((item) => (
                                    <MenuItem 
                                        key={item} 
                                        onClick={() => {
                                            setOpen(false);
                                            if (item === 'Gallery') navigate('/gallery');
                                        }}
                                        sx={{ py: 1.5, borderRadius: '0px', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' } }}
                                    >
                                        <Typography sx={{ fontFamily: typography.ui, color: colors.text }}>{item}</Typography>
                                    </MenuItem>
                                ))}
                                <Divider sx={{ my: 2, borderColor: colors.borderLight }} />
                                <MenuItem sx={{ p: 0, mb: 1 }}>
                                    <PrimaryButton fullWidth disableRipple onClick={() => {
                                        setOpen(false);
                                        navigate('/signup');
                                    }}>
                                        Sign Up
                                    </PrimaryButton>
                                </MenuItem>
                                <MenuItem sx={{ p: 0 }}>
                                    <SecondaryButton fullWidth disableRipple onClick={() => {
                                        setOpen(false);
                                        navigate('/login');
                                    }}>
                                        Log In
                                    </SecondaryButton>
                                </MenuItem>
                            </Box>
                        </Drawer>
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    );
}
