import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDZeCTVSPJ55RsC_5QqeIhvzznK_pFuZJc',
  authDomain: 'krepo-roy.firebaseapp.com',
  projectId: 'krepo-roy',
  storageBucket: 'krepo-roy.firebasestorage.app',
  messagingSenderId: '1078585984937',
  appId: '1:1078585984937:web:ca502c7c9f8489ddb366b8',
  measurementId: 'G-N8L79ZK7R7',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
