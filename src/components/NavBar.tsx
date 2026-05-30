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
import Menu from '@mui/material/Menu';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { colors, typography, PrimaryButton, SecondaryButton } from '../theme';
import { account } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';

const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

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

export default function NavBar() {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);
    const { user, profile, checkAuth } = useAuth();

    const navLinks = React.useMemo(() => {
        const links = [
            { name: 'Gallery', path: '/gallery' },
            //{ name: 'Journal', path: '/journal' },
            { name: 'About', path: '/about' }
        ];
        if (user) {
            links.push({ name: 'Studio', path: '/studio' });
            if (profile?.username) {
                links.push({ name: 'My Gallery', path: `/user/${profile.username}` });
            }
        }
        return links;
    }, [user, profile]);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const navigate = useNavigate();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            await account.deleteSession('current');
            await checkAuth(); // Refresh global auth context state (sets user to null)
            navigate('/');
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

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
                            role="button"
                            tabIndex={0}
                            aria-label="Navigate to Home"
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
                            sx={{
                                fontFamily: typography.headline,
                                color: colors.text,
                                fontSize: '24px',
                                letterSpacing: '0.02em',
                                cursor: 'pointer',
                            }}
                        >
                            {t('nav.frame')}
                        </Typography>
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                            {navLinks.map((item) => (
                                <NavButton key={item.name} disableRipple onClick={() => navigate(item.path)}>
                                    {item.name}
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
                        {user ? (
                            <>
                                <IconButton
                                    onClick={handleMenuOpen}
                                    sx={{
                                        color: colors.text,
                                        p: 1,
                                        border: `1px solid ${colors.borderLight}`,
                                        borderRadius: '0px',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            borderColor: colors.textSecondary,
                                            backgroundColor: 'rgba(0,0,0,0.02)',
                                        }
                                    }}
                                >
                                    <UserIcon />
                                </IconButton>
                                <Menu
                                    anchorEl={anchorEl}
                                    open={Boolean(anchorEl)}
                                    onClose={handleMenuClose}
                                    onClick={handleMenuClose}
                                    slotProps={{
                                        paper: {
                                            elevation: 0,
                                            sx: {
                                                overflow: 'visible',
                                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
                                                mt: 1.5,
                                                borderRadius: '0px',
                                                border: `1px solid ${colors.borderLight}`,
                                                backgroundColor: colors.surfaceBright || '#fff',
                                                minWidth: '220px',
                                                '& .MuiMenuItem-root': {
                                                    fontFamily: typography.ui,
                                                    fontSize: '14px',
                                                    color: colors.text,
                                                    py: 1.5,
                                                    px: 2,
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                                >
                                    <Box sx={{ px: 2, py: 1.5 }}>
                                        <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                                            {t('nav.account')}
                                        </Typography>
                                        <Typography sx={{ fontFamily: typography.ui, color: colors.text, fontWeight: 500, fontSize: '14px', wordBreak: 'break-all' }}>
                                            {user.name || user.email}
                                        </Typography>
                                    </Box>
                                    <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                                        {t('nav.logOut')}
                                    </MenuItem>
                                </Menu>
                            </>
                        ) : (
                            <>
                                <SecondaryButton size="small" disableRipple onClick={() => navigate('/login')}>
                                    {t('nav.logIn')}
                                </SecondaryButton>
                                <PrimaryButton size="small" disableRipple onClick={() => navigate('/signup')}>
                                    {t('nav.signUp')}
                                </PrimaryButton>
                            </>
                        )}
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
                                {navLinks.map((item) => (
                                    <MenuItem
                                        key={item.name}
                                        onClick={() => {
                                            setOpen(false);
                                            navigate(item.path);
                                        }}
                                        sx={{ py: 1.5, borderRadius: '0px', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.05)' } }}
                                    >
                                        <Typography sx={{ fontFamily: typography.ui, color: colors.text }}>{item.name}</Typography>
                                    </MenuItem>
                                ))}
                                <Divider sx={{ my: 2, borderColor: colors.borderLight }} />
                                {user ? (
                                    <>
                                        <Box sx={{ px: 2, pb: 2 }}>
                                            <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                                                {t('nav.account')}
                                            </Typography>
                                            <Typography sx={{ fontFamily: typography.ui, color: colors.text, fontWeight: 500, fontSize: '14px', wordBreak: 'break-all' }}>
                                                {user.name || user.email}
                                            </Typography>
                                        </Box>
                                        <MenuItem sx={{ p: 0 }}>
                                            <SecondaryButton fullWidth disableRipple onClick={() => {
                                                setOpen(false);
                                                handleLogout();
                                            }} sx={{ color: 'error.main' }}>
                                                {t('nav.logOut')}
                                            </SecondaryButton>
                                        </MenuItem>
                                    </>
                                ) : (
                                    <>
                                        <MenuItem sx={{ p: 0, mb: 1 }}>
                                            <PrimaryButton fullWidth disableRipple onClick={() => {
                                                setOpen(false);
                                                navigate('/signup');
                                            }}>
                                                {t('nav.signUp')}
                                            </PrimaryButton>
                                        </MenuItem>
                                        <MenuItem sx={{ p: 0 }}>
                                            <SecondaryButton fullWidth disableRipple onClick={() => {
                                                setOpen(false);
                                                navigate('/login');
                                            }}>
                                                {t('nav.logIn')}
                                            </SecondaryButton>
                                        </MenuItem>
                                    </>
                                )}
                            </Box>
                        </Drawer>
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    );
}
