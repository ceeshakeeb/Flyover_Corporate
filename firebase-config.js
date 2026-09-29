
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, off, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3Yb3bpHVOts7vlojTznpa-_pslaSbOKU",
  authDomain: "expense-book-7e014.firebaseapp.com",
  databaseURL: "https://expense-book-7e014-default-rtdb.firebaseio.com",
  projectId: "expense-book-7e014",
  storageBucket: "expense-book-7e014.firebasestorage.app",
  messagingSenderId: "764188727542",
  appId: "1:764188727542:web:9d130d81b1bcbda229f4d7",
  measurementId: "G-E6J7SMQZH1"
};

const app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = getDatabase(app);
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOutFirebase = signOut;
window.onAuthStateChangedFirebase = onAuthStateChanged;
window.dbRef = ref;
window.dbSet = set;
window.dbGet = get;
window.dbOnValue = onValue;
window.dbOff = off;
window.dbUpdate = update;
