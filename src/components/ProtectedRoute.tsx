import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function ProtectedRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        // Essential: Prevent redirects while verifying the session cookie
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        // Redirect to login, but preserve the intended destination via state
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // User is verified, render the nested routes
    return <Outlet />;
}
