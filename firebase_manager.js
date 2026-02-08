import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJIcAAozYQDaMJzRpS3XJOJ-_MjXAKvHU",
  authDomain: "lumina-words.firebaseapp.com",
  projectId: "lumina-words",
  storageBucket: "lumina-words.firebasestorage.app",
  messagingSenderId: "949656152543",
  appId: "1:949656152543:web:2674d8cdebd37a579e7c6a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

window.loginWithGoogle = async function() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Auth Error:", error);
    alert("Login failed: " + error.message);
  }
};

window.logoutFirebase = function() {
  signOut(auth);
};

window.onAuthChange = function(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
};

window.saveToFirebase = function(data) {
  if (!currentUser) return Promise.resolve();
  return setDoc(doc(db, "users", currentUser.uid), data);
};

window.listenFromFirebase = function(callback) {
  if (!currentUser) return;
  return onSnapshot(doc(db, "users", currentUser.uid), (snapshot) => {
    const data = snapshot.data();
    if (data) callback(data);
  });
};