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
// Ensure Firebase is loaded before this script runs. Typically, this is handled by the script tag in index.html.
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully.');
} else {
  console.error('Firebase SDK not loaded. Please ensure Firebase is included in your index.html.');
}

// Initialize Firebase services
let auth, db;
try {
  auth = firebase.auth();
  console.log('Firebase Auth initialized successfully');
  db = firebase.firestore();
  console.log('Firebase Firestore initialized successfully');
} catch (error) {
  console.error('Firebase services initialization error:', error);
}

// Configure Firestore settings
db.settings({
  // timestampsInSnapshots: true is deprecated and no longer needed
});

// Auth providers
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Export for use in other files
window.firebaseAuth = auth;
window.firebaseDb = db;
window.googleProvider = googleProvider;
