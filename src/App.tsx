import NavBar from './components/NavBar';
import Hero from './pages/Hero';
import FeatureCards from './components/FeatureCards';
import GalleryCarousel from './components/GalleryCarousel';
import Footer from './components/Footer';
import Login from './pages/Login';
import SignUp from './pages/SignUp';

import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <>
      <NavBar />
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
            <GalleryCarousel />
          </>
        } />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
