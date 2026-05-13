import NavBar from './components/NavBar';
import Hero from './components/Hero';
import FeatureCards from './components/FeatureCards';
import GalleryCarousel from './components/GalleryCarousel';
import Footer from './components/Footer';

import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={
          <>
            <Hero />
            <FeatureCards />
          </>
        } />
        <Route path="/gallery" element={<GalleryCarousel />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
