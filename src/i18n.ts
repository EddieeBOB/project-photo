import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "editableGallery": {
        "dropPhotos": "Drop photos here",
        "releaseToAdd": "Release to add them to your curated exhibition",
        "studioUpload": "STUDIO | UPLOAD AND CREATE",
        "clickToUpload": "CLICK TO UPLOAD",
        "delete": "Delete",
        "exposure": "Exposure",
        "iso": "ISO",
        "lens": "Lens"
      },
      "login": {
        "welcomeBack": "Welcome Back.",
        "enterDetails": "Enter your details to access your gallery.",
        "logIn": "Log In",
        "noAccount": "Don't have an account?",
        "signUp": "Sign Up"
      },
      "nav": {
        "frame": "Frame",
        "account": "Account",
        "studioWorkspace": "Studio Workspace",
        "logOut": "Log Out",
        "logIn": "Log In",
        "signUp": "Sign Up"
      },
      "signup": {
        "joinFrame": "Join Frame.",
        "createAccount": "Create an account to curate your collection.",
        "alreadyHaveAccount": "Already have an account?"
      },
      "errorBoundary": {
        "somethingWentWrong": "Something went wrong.",
        "unexpectedError": "We're sorry — an unexpected error occurred. Please reload the page to continue.",
        "reloadPage": "Reload Page"
      },
      "studioWorkspace": {
        "title": "Studio Workspace",
        "description": "Manage your active exhibitions and curate new photographic collections.",
        "noExhibitions": "You don't have any published exhibitions yet. Curate your first collection below."
      },
      "galleryCarousel": {
        "exhibitionNo": "EXHIBITION NO. ",
        "by": "by ",
        "exposure": "Exposure",
        "iso": "ISO",
        "lens": "Lens"
      },
      "hero": {
        "description": "A platform where photography can exist without the noise.",
        "exploreGallery": "Explore Gallery",
        "readJournal": "Read the Journal",
        "featuredArtist": "Featured Artist"
      },
      "footer": {
        "frame": "Frame",
        "journal": "Journal",
        "exhibitions": "Exhibitions",
        "artists": "Artists",
        "privacy": "Privacy",
        "terms": "Terms",
        "designSystem": "Luminous Editorial Design System"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
