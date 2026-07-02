import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import NavBar from './components/NavBar';
import Hero from './pages/Hero';
import FeatureCards from './components/FeatureCards';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import VerificationBanner from './components/VerificationBanner';

// Lazy load pages to split code and reduce initial bundle size
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Gallery = lazy(() => import('./pages/Gallery'));
const StudioWorkspace = lazy(() => import('./pages/StudioWorkspace'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const About = lazy(() => import('./pages/About'));
const Account = lazy(() => import('./pages/Account'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/about" element={<About />} />

            {/* Auth flow routes */}
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/" element={
              <>
                <Hero />
                <FeatureCards />
              </>
            } />
            
            {/* Public Portfolio Route */}
            <Route path="/gallery" element={<Gallery />} /> 

            {/* Dynamic Public Profile Route */}
            <Route path="/user/:username" element={<PublicProfile />} /> 

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/studio" element={<StudioWorkspace />} />
              <Route path="/account" element={<Account />} />
            </Route>
          </Routes>
        </Suspense>
      </Box>
      <VerificationBanner />
      <Footer />
    </Box>
  );
}

export default App;

