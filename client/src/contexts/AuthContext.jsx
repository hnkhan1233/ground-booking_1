import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initFirebaseApp } from '../firebase.js';

const AuthContext = createContext(null);

function createRecaptcha(auth, elementId) {
  return new RecaptchaVerifier(auth, elementId, {
    size: 'invisible',
  });
}

export function AuthProvider({ children }) {
  const app = useMemo(() => initFirebaseApp(), []);
  const auth = useMemo(() => getAuth(app), [app]);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const recaptchaVerifierRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
      if (firebaseUser) {
        setPhoneConfirmation(null);
        if (recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        }
      }
    });
    return unsubscribe;
  }, [auth]);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const startPhoneSignIn = async (phoneNumber) => {
    if (!phoneNumber) {
      throw new Error('Enter a phone number first.');
    }

    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
    }

    recaptchaVerifierRef.current = createRecaptcha(auth, 'recaptcha-container');
    try {
      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifierRef.current
      );
      setPhoneConfirmation(confirmation);
      return confirmation;
    } catch (error) {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
      throw error;
    }
  };

  const verifyPhoneCode = async (code) => {
    if (!phoneConfirmation) {
      throw new Error('No phone sign-in in progress.');
    }
    const result = await phoneConfirmation.confirm(code);
    setPhoneConfirmation(null);
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    return result;
  };

  const logout = () => signOut(auth);

  const getIdToken = async (forceRefresh = false) => {
    if (!auth.currentUser) {
      return null;
    }
    return auth.currentUser.getIdToken(forceRefresh);
  };

  const registerWithEmail = async (email, password, displayName) => {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      try {
        await updateProfile(credentials.user, { displayName });
      } catch (error) {
        console.warn('Could not update display name:', error);
      }
    }
    return credentials.user;
  };

  const loginWithEmail = (email, password) => {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const sendPasswordReset = (email) => {
    if (!email) {
      throw new Error('Enter an email to receive a password reset link.');
    }
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    initializing,
    loginWithGoogle,
    startPhoneSignIn,
    verifyPhoneCode,
    phoneConfirmation,
    logout,
    getIdToken,
    registerWithEmail,
    loginWithEmail,
    sendPasswordReset,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <div id="recaptcha-container" style={{ display: 'none' }} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
