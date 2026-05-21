import NavBar from './components/NavBar';
import Hero from './pages/Hero';
import FeatureCards from './components/FeatureCards';
import GalleryCarousel from './components/GalleryCarousel';
import EditableGalleryCarousel from './components/EditableGalleryCarousel';
import Footer from './components/Footer';
import Login from './pages/Login';
import SignUp from './pages/SignUp';

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
          <Route path="/gallery" element={
            <>
              <GalleryCarousel />
              <EditableGalleryCarousel />
            </>
          } />
        </Routes>
      </Box>
      <Footer />
    </Box>
  );
}

export default App;
