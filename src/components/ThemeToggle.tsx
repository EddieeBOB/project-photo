import IconButton from '@mui/material/IconButton';

import { colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { MoonIcon, SunIcon } from './icons';

/**
 * Switches between light and dark mode.
 *
 * The icon shows the mode you'd switch *to*, not the one you're in — a moon
 * while in light mode.
 */
export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';

    return (
        <IconButton
            onClick={toggleTheme}
            disableRipple
            aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            sx={{
                color: colors.text,
                p: 1,
                border: `1px solid ${colors.borderLight}`,
                borderRadius: '0px',
                transition: 'border-color 0.3s ease, background-color 0.3s ease',
                '&:hover': {
                    borderColor: colors.text,
                    backgroundColor: colors.hoverOverlaySubtle,
                },
            }}
        >
            {isLight ? <MoonIcon /> : <SunIcon />}
        </IconButton>
    );
}
