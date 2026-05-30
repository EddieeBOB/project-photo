import NavBar from './components/NavBar';
import Hero from './pages/Hero';
import FeatureCards from './components/FeatureCards';
import Gallery from './pages/Gallery';
import Footer from './components/Footer';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ProtectedRoute from './components/ProtectedRoute';
import StudioWorkspace from './pages/StudioWorkspace';

import { Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
      </Box>
      <Footer />
    </Box>
  );
}

export default App;
