import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

import { typography } from '../theme';

interface ToastProps {
    /** The text to show. `null` keeps the toast closed. */
    message: string | null;
    severity?: AlertColor;
    onClose: () => void;
}

/**
 * The app's transient feedback message: a bottom-left snackbar that auto-hides.
 *
 * Every page raised its own identically-styled `Snackbar`/`Alert` pair, so this
 * exists to keep that styling in one place — drive it from a nullable message
 * state and it opens and closes itself.
 */
export default function Toast({ message, severity = 'error', onClose }: ToastProps) {
    return (
        <Snackbar open={!!message} autoHideDuration={6000} onClose={onClose}>
            <Alert
                onClose={onClose}
                severity={severity}
                sx={{ width: '100%', borderRadius: '0px', fontFamily: typography.ui }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
}
