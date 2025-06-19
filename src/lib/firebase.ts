
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyC6FQSlDmU3rNinpfh6ffJXKdGpHCFx0Ok",
  authDomain: "apppagos-e3def.firebaseapp.com",
  projectId: "apppagos-e3def",
  storageBucket: "apppagos-e3def.firebasestorage.app",
  messagingSenderId: "761784623585",
  appId: "1:761784623585:web:e6531159eb1a0de6b2f2a0",
  measurementId: "G-JMYX7MGKBS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics only in browser environment
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };
