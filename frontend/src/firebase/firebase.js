import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAvNMkGSKtOuC7nnaaqVKCZ7WWKStjkNvs",
  authDomain: "signups-68cfb.firebaseapp.com",
  projectId: "signups-68cfb",
  storageBucket: "signups-68cfb.firebasestorage.app",
  messagingSenderId: "145178864426",
  appId: "1:145178864426:web:ebecc2f95f4e54966ccc53",
  measurementId: "G-EZVDPTPHNH"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

