import * as React from 'react';
import { styled, alpha } from '@mui/material/styles';
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

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: `calc(${theme.shape.borderRadius}px + 12px)`,
    backdropFilter: 'blur(32px)',
    border: '1px solid',
    borderColor: alpha(theme.palette.divider, 0.2),
    backgroundColor: theme.vars 
        ? `rgba(${theme.vars.palette.background.paperChannel} / 0.8)`
        : alpha(theme.palette.background.paper, 0.8),
    boxShadow: `0 4px 30px ${alpha(theme.palette.common.black, 0.05)}`,
    padding: '12px 24px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
        boxShadow: `0 8px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
        borderColor: alpha(theme.palette.primary.main, 0.3),
    }
}));

const NavButton = styled(Button)(({ theme }) => ({
    color: theme.palette.text.primary,
    fontWeight: 500,
    fontSize: '0.95rem',
    textTransform: 'none',
    position: 'relative',
    overflow: 'hidden',
    padding: '6px 16px',
    transition: 'all 0.3s ease',
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: '50%',
        width: '0%',
        height: '2px',
        backgroundColor: theme.palette.primary.main,
        transition: 'all 0.3s ease',
        transform: 'translateX(-50%)',
    },
    '&:hover': {
        backgroundColor: 'transparent',
        color: theme.palette.primary.main,
        '&::after': {
            width: '80%',
        }
    }
}));

const PrimaryButton = styled(Button)(({ theme }) => ({
    borderRadius: '24px',
    textTransform: 'none',
    fontWeight: 600,
    padding: '8px 24px',
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    boxShadow: `0 4px 14px 0 ${alpha(theme.palette.primary.main, 0.39)}`,
    transition: 'all 0.3s ease',
    color: '#fff',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 6px 20px 0 ${alpha(theme.palette.primary.main, 0.49)}`,
    }
}));

export default function NavBar() {
    const [open, setOpen] = React.useState(false);

    const toggleDrawer = (newOpen: boolean) => () => {
        setOpen(newOpen);
    };

    return (
        <AppBar
            position="fixed"
            enableColorOnDark
            sx={{
                boxShadow: 0,
                bgcolor: 'transparent',
                backgroundImage: 'none',
                mt: 3,
            }}
        >
            <Container maxWidth="lg">
                <StyledToolbar variant="regular" disableGutters>
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ 
                            background: 'linear-gradient(45deg, #aa3bff, #c084fc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            cursor: 'pointer'
                        }}>
                            Project Photo
                        </Typography>
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                            {['Features', 'Testimonials', 'Highlights', 'Pricing', 'FAQ', 'Blog'].map((item) => (
                                <NavButton key={item} disableRipple>
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
                        <NavButton size="small" disableRipple>
                            Sign in
                        </NavButton>
                        <PrimaryButton size="small">
                            Get Started
                        </PrimaryButton>
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <IconButton aria-label="Menu button" onClick={toggleDrawer(true)}>
                            <MenuIcon />
                        </IconButton>
                        <Drawer
                            anchor="top"
                            open={open}
                            onClose={toggleDrawer(false)}
                            PaperProps={{
                                sx: {
                                    backdropFilter: 'blur(24px)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                }
                            }}
                        >
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                                    <IconButton onClick={toggleDrawer(false)}>
                                        <CloseRoundedIcon />
                                    </IconButton>
                                </Box>
                                {['Features', 'Testimonials', 'Highlights', 'Pricing', 'FAQ', 'Blog'].map((item) => (
                                    <MenuItem key={item} sx={{ py: 1.5, borderRadius: 2, '&:hover': { backgroundColor: 'rgba(170, 59, 255, 0.08)' } }}>
                                        <Typography fontWeight={500}>{item}</Typography>
                                    </MenuItem>
                                ))}
                                <Divider sx={{ my: 2 }} />
                                <MenuItem sx={{ p: 0 }}>
                                    <PrimaryButton fullWidth sx={{ mb: 1 }}>
                                        Sign up
                                    </PrimaryButton>
                                </MenuItem>
                                <MenuItem sx={{ p: 0 }}>
                                    <Button variant="outlined" fullWidth sx={{ borderRadius: '24px', py: 1 }}>
                                        Sign in
                                    </Button>
                                </MenuItem>
                            </Box>
                        </Drawer>
                    </Box>
                </StyledToolbar>
            </Container>
        </AppBar>
    );
}
