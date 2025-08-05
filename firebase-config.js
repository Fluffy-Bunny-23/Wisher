// Firebase Configuration
// Replace these values with your own Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBrYt9QTTYlUCvHSg972wZKDAI2VeByYrA",
  authDomain: "wisher-lists.firebaseapp.com",
  projectId: "wisher-lists",
  storageBucket: "wisher-lists.firebasestorage.app",
  messagingSenderId: "1064489993372",
  appId: "1:1064489993372:web:21238cc6ed82bf48c05959",
  measurementId: "G-WKD3PGQ61E"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Configure Firestore settings
db.settings({
  timestampsInSnapshots: true
});

// Auth providers
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Export for use in other files
window.firebaseAuth = auth;
window.firebaseDb = db;
window.googleProvider = googleProvider;
