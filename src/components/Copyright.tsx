import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { colors, typography } from '../theme';

/** Copyright line at the foot of the auth pages. */
export default function Copyright() {
    return (
        <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography
                sx={{
                    fontFamily: typography.ui,
                    color: colors.textSecondary,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                © {new Date().getFullYear()} Frame Collective.
            </Typography>
        </Box>
    );
}
