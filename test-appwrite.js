import { fetchFeaturedArtist } from './src/services/photoService.js';
fetchFeaturedArtist().then(data => console.log("Result:", data)).catch(err => console.error("Error:", err));
