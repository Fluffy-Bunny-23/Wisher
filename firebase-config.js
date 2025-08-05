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

// Firestore Security Rules (copy these to your Firebase Console)
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lists collection
    match /lists/{listId} {
      // Allow read if user is owner, collaborator, or viewer
      allow read: if isOwner(resource.data) || 
                     isCollaborator(resource.data) || 
                     isViewer(resource.data) ||
                     isPublicList(resource.data);
      
      // Allow write if user is owner or collaborator
      allow write: if isOwner(resource.data) || 
                      isCollaborator(resource.data);
      
      // Allow create if user is authenticated
      allow create: if request.auth != null;
      
      // Items subcollection
      match /items/{itemId} {
        // Allow read with same permissions as parent list
        allow read: if isOwner(getList()) || 
                       isCollaborator(getList()) || 
                       isViewer(getList()) ||
                       isPublicList(getList());
        
        // Allow write if user is owner or collaborator of parent list
        allow write: if isOwner(getList()) || 
                        isCollaborator(getList());
        
        // Allow create if user has write access to parent list
        allow create: if isOwner(getList()) || 
                         isCollaborator(getList());
        
        // Special rule for marking items as bought - anyone can do this
        allow update: if request.auth != null && 
                         onlyUpdatingBoughtFields();
      }
      
      // Comments subcollection
      match /comments/{commentId} {
        // Allow read with same permissions as parent list
        allow read: if isOwner(getList()) || 
                       isCollaborator(getList()) || 
                       isViewer(getList());
        
        // Allow write if user is authenticated (viewers can comment)
        allow write: if request.auth != null && 
                        (isOwner(getList()) || 
                         isCollaborator(getList()) || 
                         isViewer(getList()));
        
        // Allow create if user is authenticated
        allow create: if request.auth != null;
      }
    }
    
    // User profiles
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Helper functions
    function isOwner(listData) {
      return request.auth != null && 
             request.auth.token.email == listData.owner;
    }
    
    function isCollaborator(listData) {
      return request.auth != null && 
             listData.collaborators.hasAny([request.auth.token.email]);
    }
    
    function isViewer(listData) {
      return request.auth != null && 
             (listData.isPublic == true || 
              listData.viewers.hasAny([request.auth.token.email]));
    }
    
    function isPublicList(listData) {
      return listData.isPublic == true;
    }
    
    function getList() {
      return get(/databases/$(database)/documents/lists/$(listId)).data;
    }
    
    function onlyUpdatingBoughtFields() {
      return request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['bought', 'buyerEmail', 'buyerName', 'buyerNote', 'datePurchased']);
    }
  }
}
*/