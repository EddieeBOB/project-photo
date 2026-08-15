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
import MenuList from '@mui/material/MenuList';
import Drawer from '@mui/material/Drawer';
import MenuIcon from '@mui/icons-material/Menu';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import type { Models } from 'appwrite';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { colors, typography, PrimaryButton, SecondaryButton } from '../theme';
import UserSearch from './UserSearch';
import ThemeToggle from './ThemeToggle';
import { UserIcon } from './icons';
import { account } from '../lib/appwrite';
import { clearRememberPreference } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

interface NavLink {
    name: string;
    path: string;
}

/**
 * MUI's `styled()` wrappers lose the polymorphic `component` prop's typing, so
 * router props are spread through an `object` cast. Isolated here rather than
 * repeated inline at every call site.
 */
const routerLink = (to: string) => ({ component: RouterLink, to }) as object;

const StyledToolbar = styled(Toolbar)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: '0px',
    backdropFilter: 'blur(24px)',
    border: `1px solid ${colors.borderLight}`,
    backgroundColor: colors.surfaceTransparent,
    padding: '12px 24px',
});

/** Text nav link that draws an underline out from its centre on hover. */
const NavButton = styled(Button)({
    color: colors.text,
    fontFamily: typography.ui,
    fontWeight: 400,
    fontSize: '14px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    borderRadius: '0px',
    padding: '8px 16px',
    transition: 'color 0.3s ease-in-out',
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
        transition: 'width 0.3s ease',
        transform: 'translateX(-50%)',
    },
    '&:hover': {
        backgroundColor: 'transparent',
        color: colors.primary,
        '&::after': {
            width: '100%',
        },
    },
});

/** "ACCOUNT" over the signed-in user's name — shown in both menu and drawer. */
function AccountIdentity({ user, sx }: { user: Models.User<Models.Preferences>; sx?: object }) {
    const { t } = useTranslation();

    return (
        <Box sx={sx}>
            <Typography sx={{ fontFamily: typography.ui, color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                {t('nav.account')}
            </Typography>
            <Typography sx={{ fontFamily: typography.ui, color: colors.text, fontWeight: 500, fontSize: '14px', wordBreak: 'break-all' }}>
                {user.name || user.email}
            </Typography>
        </Box>
    );
}

/** Desktop avatar button and the account dropdown it opens. */
function AccountMenu({
    user,
    onLogout,
}: {
    user: Models.User<Models.Preferences>;
    onLogout: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

    return (
        <>
            <IconButton
                onClick={(event) => setAnchorEl(event.currentTarget)}
                aria-label="Open account menu"
                aria-haspopup="true"
                aria-expanded={Boolean(anchorEl)}
                sx={{
                    color: colors.text,
                    p: 1,
                    border: `1px solid ${colors.borderLight}`,
                    borderRadius: '0px',
                    transition: 'border-color 0.3s ease, background-color 0.3s ease',
                    '&:hover': {
                        borderColor: colors.textSecondary,
                        backgroundColor: colors.hoverOverlaySubtle,
                    },
                }}
            >
                <UserIcon />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                // Any click inside closes the menu, so items don't each have to.
                onClick={() => setAnchorEl(null)}
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
                                    backgroundColor: colors.hoverOverlaySubtle,
                                },
                            },
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <AccountIdentity user={user} sx={{ px: 2, py: 1.5 }} />
                <MenuItem onClick={() => navigate('/account')}>
                    {t('nav.account', 'Account')}
                </MenuItem>
                <MenuItem onClick={onLogout} sx={{ color: 'error.main' }}>
                    {t('nav.logOut')}
                </MenuItem>
            </Menu>
        </>
    );
}

/** Full-width menu that drops from the top on small screens. */
function MobileDrawer({
    open,
    onClose,
    navLinks,
    user,
    onLogout,
}: {
    open: boolean;
    onClose: () => void;
    navLinks: NavLink[];
    user: Models.User<Models.Preferences> | null;
    onLogout: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    /** Drawer entries navigate and dismiss together. */
    const goTo = (path: string) => () => {
        onClose();
        navigate(path);
    };

    const itemSx = { py: 1.5, borderRadius: '0px', '&:hover': { backgroundColor: colors.hoverOverlay } };

    return (
        <Drawer
            anchor="top"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    backdropFilter: 'blur(24px)',
                    backgroundColor: colors.surfaceTransparent,
                    borderBottom: `1px solid ${colors.borderLight}`,
                    borderRadius: '0px',
                    overscrollBehavior: 'contain',
                },
            }}
        >
            <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <IconButton aria-label="Close navigation menu" onClick={onClose} sx={{ color: colors.text }}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <UserSearch fullWidth onSelect={onClose} />
                </Box>

                <MenuList sx={{ p: 0 }}>
                    {navLinks.map((link) => (
                        <MenuItem key={link.name} onClick={goTo(link.path)} sx={itemSx}>
                            <Typography sx={{ fontFamily: typography.ui, color: colors.text }}>{link.name}</Typography>
                        </MenuItem>
                    ))}

                    <Divider sx={{ my: 2, borderColor: colors.borderLight }} />

                    {user ? (
                        <>
                            <AccountIdentity user={user} sx={{ px: 2, pb: 2 }} />
                            <MenuItem onClick={goTo('/account')} sx={itemSx}>
                                <Typography sx={{ fontFamily: typography.ui, color: colors.text }}>{t('nav.account', 'Account')}</Typography>
                            </MenuItem>
                            <MenuItem sx={{ p: 0 }}>
                                <SecondaryButton
                                    fullWidth
                                    disableRipple
                                    onClick={() => { onClose(); onLogout(); }}
                                    sx={{ color: 'error.main' }}
                                >
                                    {t('nav.logOut')}
                                </SecondaryButton>
                            </MenuItem>
                        </>
                    ) : (
                        <>
                            <MenuItem sx={{ p: 0, mb: 1 }}>
                                <PrimaryButton fullWidth disableRipple onClick={goTo('/signup')}>
                                    {t('nav.signUp')}
                                </PrimaryButton>
                            </MenuItem>
                            <MenuItem sx={{ p: 0 }}>
                                <SecondaryButton fullWidth disableRipple onClick={goTo('/login')}>
                                    {t('nav.logIn')}
                                </SecondaryButton>
                            </MenuItem>
                        </>
                    )}
                </MenuList>
            </Box>
        </Drawer>
    );
}

/**
 * The fixed top navigation: brand, section links, photographer search, theme
 * toggle, and either the account menu or the sign-in buttons. Below `md` the
 * links and account actions collapse into {@link MobileDrawer}.
 */
export default function NavBar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, profile, checkAuth } = useAuth();
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    // Studio and the public-profile shortcut only exist for a signed-in user,
    // and the latter only once their profile row has loaded.
    const navLinks: NavLink[] = React.useMemo(() => {
        const links = [
            { name: 'Gallery', path: '/gallery' },
            { name: 'About', path: '/about' },
        ];
        if (user) {
            links.push({ name: 'Studio', path: '/studio' });
            if (profile?.username) {
                links.push({ name: 'My Public Gallery', path: `/user/${profile.username}` });
            }
        }
        return links;
    }, [user, profile]);

    const handleLogout = async () => {
        try {
            await account.deleteSession({ sessionId: 'current' });
            clearRememberPreference();
            await checkAuth(); // Refresh global auth context state (sets user to null)
            navigate('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
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
                    {/* Brand and section links */}
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Typography
                            variant="h6"
                            component={RouterLink}
                            to="/"
                            aria-label="Frame — go to home"
                            sx={{
                                fontFamily: typography.headline,
                                color: colors.text,
                                fontSize: '24px',
                                letterSpacing: '0.02em',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                '&:focus-visible': {
                                    outline: `2px solid ${colors.text}`,
                                    outlineOffset: '4px',
                                },
                            }}
                        >
                            {t('nav.frame')}
                        </Typography>
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                            {navLinks.map((link) => (
                                <NavButton key={link.name} {...routerLink(link.path)} disableRipple>
                                    {link.name}
                                </NavButton>
                            ))}
                        </Box>
                    </Box>

                    {/* Desktop actions */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, alignItems: 'center' }}>
                        <UserSearch />
                        <ThemeToggle />
                        {user ? (
                            <AccountMenu user={user} onLogout={handleLogout} />
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

                    {/* Mobile actions */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5 }}>
                        <ThemeToggle />
                        <IconButton
                            aria-label="Open navigation menu"
                            aria-expanded={drawerOpen}
                            onClick={() => setDrawerOpen(true)}
                            sx={{ color: colors.text }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <MobileDrawer
                            open={drawerOpen}
                            onClose={() => setDrawerOpen(false)}
                            navLinks={navLinks}
                            user={user}
                            onLogout={handleLogout}
                        />
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    );
}
