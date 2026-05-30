import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import NavBar from './components/NavBar';
import Hero from './pages/Hero';
import FeatureCards from './components/FeatureCards';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load pages to split code and reduce initial bundle size
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Gallery = lazy(() => import('./pages/Gallery'));
const StudioWorkspace = lazy(() => import('./pages/StudioWorkspace'));

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
            <Route path="/" element={
              <>
                <Hero />
                <FeatureCards />
              </>
            } />
            
            {/* Public Portfolio Route */}
            <Route path="/gallery" element={<Gallery />} /> 

            {/* Protected Studio/Management Route */}
            <Route element={<ProtectedRoute />}>
              <Route path="/studio" element={<StudioWorkspace />} /> 
            </Route>
          </Routes>
        </Suspense>
      </Box>
      <Footer />
    </Box>
  );
}

export default App;

