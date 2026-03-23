import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBMfhyc-5L-N693ITCTDwtHrbkaKS4Mhkg',
  authDomain: 'krepo-cd270.firebaseapp.com',
  projectId: 'krepo-cd270',
  storageBucket: 'krepo-cd270.firebasestorage.app',
  messagingSenderId: '485211856700',
  appId: '1:485211856700:web:25f6cd8660ec8bdc988839',
  measurementId: 'G-2HFPRNDW1Z',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
