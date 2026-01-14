// Firebase Configuration
// SECURITY WARNING: Never commit real API keys to version control
// For production, use environment variables or Firebase SDK auto-configuration
// Restrict API key in Firebase console to authorized domains and implement proper quotas
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || "AIzaSyBrYt9QTTYlUCvHSg972wZKDAI2VeByYrA",
  authDomain: "wisher-lists.firebaseapp.com",
  projectId: "wisher-lists",
  storageBucket: "wisher-lists.firebasestorage.app",
  messagingSenderId: "1064489993372",
  appId: "1:1064489993372:web:21238cc6ed82bf48c05959",
  measurementId: "G-WKD3PGQ61E"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Auth
const firebaseAuth = firebase.auth();

// Initialize Firestore
const db = firebase.firestore();

// Initialize Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Optional: Add scopes
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Make auth and db available globally for app.js
window.firebaseAuth = firebaseAuth;
window.db = db;
window.googleProvider = googleProvider;

console.log('Firebase initialized successfully');
