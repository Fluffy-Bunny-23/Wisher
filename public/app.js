// Global state
let currentUser = null;
let currentList = null;
let currentListId = null;
let currentListRole = null; // Global variable to store the role from the URL
let showBoughtItems = false;
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
let selectedItems = [];
let lastSelectedItemId = null;

// DOM elements
const authScreen = document.getElementById('authScreen');
const listScreen = document.getElementById('listScreen');
const wishlistScreen = document.getElementById('wishlistScreen');
const loadingSpinner = document.getElementById('loadingSpinner');
const sidebar = document.getElementById('sidebar');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarListContainer = document.getElementById('sidebarListContainer');
const createListSidebarBtn = document.getElementById('createListSidebarBtn');
const menuButton = document.getElementById('menuButton'); // Assuming you have a menu button in your app-bar
const mainContent = document.querySelector('.main-content'); // Or the main container that needs to shift
const appBar = document.getElementById('app-bar');

function setupAuthStateListener() {
    console.log('Setting up auth state listener');
    
    // Check if firebaseAuth is initialized
    if (!firebaseAuth) {
        console.error('Firebase Auth not initialized, cannot set up auth state listener');
        showToast('Authentication service not available. Please refresh the page.', 'error');
        return;
    }
    
    try {
        const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
            console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
            if (user) {
                console.log('User provider data:', user.providerData); // Add this line to inspect provider data
            }
            if (user) {
                console.log('User details:', user.email, user.uid, user.providerData);
                currentUser = user;
                onUserSignedIn();
            } else {
                console.log('No user signed in');
                currentUser = null;
                onUserSignedOut();
            }
        }, error => {
            console.error('Auth state listener error:', error);
            showToast('Authentication error: ' + error.message, 'error');
        });
        
        console.log('Auth state listener set up successfully');
        
        // Store the unsubscribe function for potential cleanup
        window.authUnsubscribe = unsubscribe;
    } catch (error) {
        console.error('Error setting up auth state listener:', error);
        showToast('Failed to initialize authentication. Please refresh the page.', 'error');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupAuthStateListener();
});



function initializeApp() {
    console.log('Initializing app');
    try {
        // Check for list ID in URL
        const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role'); // Extract role from URL
        const listId = urlParams.get('list');
        const itemId = urlParams.get('item');
        
        if (listId) {
            console.log('List ID found in URL:', listId);
            currentListId = listId;
            // Store in localStorage for quick access
            localStorage.setItem('lastViewedList', listId);
            // Persist pending shared link so it survives login redirects
            localStorage.setItem('pendingSharedListId', listId);
            if (role) {
                currentListRole = role; // Store the role globally
                localStorage.setItem('pendingSharedListRole', role);
                // Call a function to handle shared list access
                handleSharedListAccess(listId, role);
            }
        }
        
        // Gemini API Key will be loaded from the list data, not localStorage directly
        // The input field will be updated when settings are loaded or a list is loaded.
        
        // Ensure DOM elements are properly initialized
        console.log('Verifying DOM elements initialization');
        if (!authScreen) console.error('Element not found: authScreen');
        if (!listScreen) console.error('Element not found: listScreen');
        if (!wishlistScreen) console.error('Element not found: wishlistScreen');
        if (!loadingSpinner) console.error('Element not found: loadingSpinner');
        if (!sidebar) console.error('Element not found: sidebar');
        if (!sidebarCloseBtn) console.error('Element not found: sidebarCloseBtn');
        if (!sidebarListContainer) console.error('Element not found: sidebarListContainer');
        if (!createListSidebarBtn) console.error('Element not found: createListSidebarBtn');
        if (!menuButton) console.error('Element not found: menuButton');
        if (!mainContent) console.error('Element not found: mainContent');
        if (!appBar) console.error('Element not found: appBar');
        
        console.log('App initialization completed');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

function setupAuthStateListener() {
    console.log('Setting up auth state listener');
    
    // Check if firebaseAuth is initialized
    if (!firebaseAuth) {
        console.error('Firebase Auth not initialized, cannot set up auth state listener');
        showToast('Authentication service not available. Please refresh the page.', 'error');
        return;
    }
    
    try {
        const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
            console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
            if (user) {
                console.log('User provider data:', user.providerData); // Add this line to inspect provider data
            }
            if (user) {
                console.log('User details:', user.email, user.uid, user.providerData);
                currentUser = user;
                onUserSignedIn();
            } else {
                console.log('No user signed in');
                currentUser = null;
                onUserSignedOut();
            }
        }, error => {
            console.error('Auth state listener error:', error);
            showToast('Authentication error: ' + error.message, 'error');
        });
        
        console.log('Auth state listener set up successfully');
        
        // Store the unsubscribe function for potential cleanup
        window.authUnsubscribe = unsubscribe;
    } catch (error) {
        console.error('Error setting up auth state listener:', error);
        showToast('Failed to initialize authentication. Please refresh the page.', 'error');
    }
}

async function handleSharedListAccess(listId, role) {
    if (!currentUser || !currentUser.email) {
        console.warn('User not signed in, cannot handle shared list access yet.');
        return; // Wait for user to sign in
    }

    try {
        const listRef = firebaseDb.collection('lists').doc(listId);
        const doc = await listRef.get();

        if (doc.exists) {
            const listData = doc.data();
            const userEmail = currentUser.email;

            const collaboratorsField = listData.collaborators || [];
            const viewersField = listData.viewers || [];

            const isAlreadyCollaborator = Array.isArray(collaboratorsField)
                ? collaboratorsField.includes(userEmail)
                : (typeof collaboratorsField === 'object' && collaboratorsField !== null
                    ? Object.values(collaboratorsField).includes(userEmail)
                    : false);

            const isAlreadyViewer = Array.isArray(viewersField)
                ? viewersField.includes(userEmail)
                : (typeof viewersField === 'object' && viewersField !== null
                    ? Object.values(viewersField).includes(userEmail)
                    : false);

            let updated = false;
            if (role === 'collaborator' && !isAlreadyCollaborator) {
                if (Array.isArray(collaboratorsField)) {
                    await listRef.update({
                        collaborators: firebase.firestore.FieldValue.arrayUnion(userEmail)
                    });
                } else {
                    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
                    if (uid) {
                        const updateData = {};
                        updateData[`collaborators.${uid}`] = userEmail;
                        await listRef.update(updateData);
                    }
                }
                console.log(`User ${userEmail} added as collaborator to list ${listId}`);
                updated = true;
            } else if (role === 'viewer' && !isAlreadyViewer) {
                if (Array.isArray(viewersField)) {
                    await listRef.update({
                        viewers: firebase.firestore.FieldValue.arrayUnion(userEmail)
                    });
                } else {
                    const uid = currentUser && currentUser.uid ? currentUser.uid : null;
                    if (uid) {
                        const updateData = {};
                        updateData[`viewers.${uid}`] = userEmail;
                        await listRef.update(updateData);
                    }
                }
                console.log(`User ${userEmail} added as viewer to list ${listId}`);
                updated = true;
            }

            if (updated) {
                showToast(`You have been added as a ${role} to this list!`, 'success');
                // Reload the list to reflect changes
                loadList(listId);
            }
        } else {
            console.warn(`List ${listId} not found for shared access.`);
        }
    } catch (error) {
        console.error('Error handling shared list access:', error);
        showToast('Error joining shared list: ' + error.message, 'error');
    }
}

function onUserSignedIn() {
    console.log('User signed in:', currentUser);
    try {
        hideLoading();
        document.getElementById('loginButton').classList.add('hidden');
        document.getElementById('userBtn').classList.remove('hidden');
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userUid').textContent = currentUser.uid;

        // Restore pending shared link data if not already set
        if (!currentListId) {
            const storedListId = localStorage.getItem('pendingSharedListId');
            if (storedListId) {
                currentListId = storedListId;
            }
        }
        if (!currentListRole) {
            const storedRole = localStorage.getItem('pendingSharedListRole');
            if (storedRole) {
                currentListRole = storedRole;
            }
        }

        console.log('Checking for specific list ID in URL or storage:', currentListId);
        if (currentListId) {
            // Load specific list from URL/storage
            console.log('Loading specific list:', currentListId);
            loadList(currentListId);
            if (currentListRole) {
                handleSharedListAccess(currentListId, currentListRole);
            }
            // Clear pending storage once processed
            localStorage.removeItem('pendingSharedListId');
            localStorage.removeItem('pendingSharedListRole');
        } else {
            // Show user's lists
            console.log('No specific list ID, showing list screen and loading user lists');
            showScreen('listScreen');
            loadUserLists();
        }
    } catch (error) {
        console.error('Error in onUserSignedIn:', error);
        hideLoading();
        showToast('Error loading application: ' + error.message, 'error');
    }
}

function onUserSignedOut() {
    hideLoading();
    showScreen('authScreen');
    document.getElementById('loginButton').classList.remove('hidden');
    document.getElementById('userBtn').classList.add('hidden');
    // Hide user profile modal if it's open
    hideModal('userProfileModal');
    currentList = null;
    currentListId = null;
}

function setupEventListeners() {

    try {
        console.log('Setting up event listeners');
        
        // Auth buttons
        const googleSignIn = document.getElementById('googleSignIn');
        if (googleSignIn) {
            googleSignIn.addEventListener('click', signInWithGoogle);
        } else {
            console.error('Element not found: googleSignIn');
        }
        
        const emailSignIn = document.getElementById('emailSignIn');
        if (emailSignIn) {
            emailSignIn.addEventListener('click', toggleEmailAuth);
        } else {
            console.error('Element not found: emailSignIn');
        }
        
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', signInWithEmail);
        } else {
            console.error('Element not found: signInBtn');
        }
        
        const signUpBtn = document.getElementById('signUpBtn');
        if (signUpBtn) {
            signUpBtn.addEventListener('click', signUpWithEmail);
        } else {
            console.error('Element not found: signUpBtn');
        }
        
        // App bar buttons
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => showModal('helpModal'));
        } else {
            console.error('Element not found: helpBtn');
        }
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                loadSettings(); // Load settings when modal is opened
                showModal('settingsModal');
            });
        } else {
            console.error('Element not found: settingsBtn');
        }
        
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => showModal('shareModal'));
        } else {
            console.error('Element not found: shareBtn');
        }
        
        const userBtn = document.getElementById('userBtn');
        if (userBtn) {
            userBtn.addEventListener('click', () => showModal('userProfileModal'));
        } else {
            console.error('Element not found: userBtn');
        }

        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                // Ensure the profile modal closes immediately on logout click
                hideModal('userProfileModal');
                signOut();
            });
        } else {
            console.error('Element not found: logoutButton');
        }
        
        // List management
        const createListBtn = document.getElementById('createListBtn');
        if (createListBtn) {
            createListBtn.addEventListener('click', createNewList);
        } else {
            console.error('Element not found: createListBtn');
        }
        
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => showAddItemModal());
        } else {
            console.error('Element not found: addItemBtn');
        }
        
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => showAddGroupModal());
        } else {
            console.error('Element not found: addGroupBtn');
        }
        
        const manageListBtn = document.getElementById('manageListBtn');
        if (manageListBtn) {
            manageListBtn.addEventListener('click', () => showEditModal());
        } else {
            console.error('Element not found: manageListBtn');
        }

        const importListBtn = document.getElementById('importListBtn');
        if (importListBtn) {
            importListBtn.addEventListener('click', importList);
        } else {
            console.error('Element not found: importListBtn');
        }
    
    // Modals
        const saveItemBtn = document.getElementById('saveItemBtn');
        if (saveItemBtn) {
            saveItemBtn.addEventListener('click', saveItem);
        } else {
            console.error('Element not found: saveItemBtn');
        }
        
        const cancelItemBtn = document.getElementById('cancelItemBtn');
        if (cancelItemBtn) {
            cancelItemBtn.addEventListener('click', () => hideModal('itemModal'));
        } else {
            console.error('Element not found: cancelItemBtn');
        }
        
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveSettings);
        } else {
            console.error('Element not found: saveSettingsBtn');
        }
        
        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        if (cancelSettingsBtn) {
            cancelSettingsBtn.addEventListener('click', () => hideModal('settingsModal'));
        } else {
            console.error('Element not found: cancelSettingsBtn');
        }
        
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', saveListEdit);
        
        } else {
            console.error('Element not found: saveEditBtn');
        }

        // Group modal buttons
        const saveGroupBtn = document.getElementById('saveGroupBtn');
        if (saveGroupBtn) {
            saveGroupBtn.addEventListener('click', saveGroup);
        } else {
            console.error('Element not found: saveGroupBtn');
        }

        const cancelGroupBtn = document.getElementById('cancelGroupBtn');
        if (cancelGroupBtn) {
            cancelGroupBtn.addEventListener('click', () => hideModal('groupModal'));
        } else {
            console.error('Element not found: cancelGroupBtn');
        }
        
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => hideModal('editModal'));
        } else {
            console.error('Element not found: cancelEditBtn');
        }
        
        const addCollaboratorBtn = document.getElementById('addCollaboratorBtn');
        if (addCollaboratorBtn) {
            addCollaboratorBtn.addEventListener('click', addCollaborator);
        } else {
            console.error('Element not found: addCollaboratorBtn');
        }
        
        const addViewerBtn = document.getElementById('addViewerBtn');
        if (addViewerBtn) {
            addViewerBtn.addEventListener('click', addViewer);
        } else {
            console.error('Element not found: addViewerBtn');
        }
        
        // Show bought items toggle
        const showBoughtToggle = document.getElementById('showBoughtToggle');
        if (showBoughtToggle) {
            showBoughtToggle.addEventListener('change', toggleBoughtItems);
        } else {
            console.error('Element not found: showBoughtToggle');
        }
        
        // Share buttons
        try {
            setupShareButtons();
        } catch (error) {
            console.error('Error setting up share buttons:', error);
        }
        
        // Modal close buttons
        try {
            const closeButtons = document.querySelectorAll('.modal-close');
            if (closeButtons.length > 0) {
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const modal = e.target.closest('.modal');
                        if (modal) {
                            hideModal(modal.id);
                        }
                    });
                });
            } else {
                console.error('No modal close buttons found');
            }
        } catch (error) {
            console.error('Error setting up modal close buttons:', error);
        }
        
        // Click outside modal to close
        try {
            const modals = document.querySelectorAll('.modal');
            if (modals.length > 0) {
                modals.forEach(modal => {
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            hideModal(modal.id);
                        }
                    });
                });
            } else {
                console.error('No modals found');
            }
        } catch (error) {
            console.error('Error setting up modal click outside:', error);
        }
        
        // Sidebar event listeners
        if (menuButton) {
            menuButton.addEventListener('click', toggleSidebar);
        } else {
            console.error('Element not found: menuButton');
        }
        
        if (sidebarCloseBtn) {
            sidebarCloseBtn.addEventListener('click', toggleSidebar);
        } else {
            console.error('Element not found: sidebarCloseBtn');
        }
        
        if (createListSidebarBtn) {
            createListSidebarBtn.addEventListener('click', () => {
                toggleSidebar();
                createNewList();
            });
        } else {
            console.error('Element not found: createListSidebarBtn');
        }
        
        console.log('Event listeners setup completed');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
    // Add event delegation for sidebar list items after they are loaded
    try {
        if (sidebarListContainer) {
            sidebarListContainer.addEventListener('click', (e) => {
                try {
                    if (e.target.tagName === 'LI' && e.target.dataset.listId) {
                        console.log('Sidebar list item clicked, loading list:', e.target.dataset.listId);
                        toggleSidebar();
                        loadList(e.target.dataset.listId);
                    }
                } catch (error) {
                    console.error('Error handling sidebar list item click:', error);
                }
            });
        } else {
            console.error('Element not found: sidebarListContainer');
        }
    } catch (error) {
        console.error('Error setting up sidebar list container event listener:', error);
    }
}

// Authentication functions
async function signInWithGoogle() {
    console.log('Starting Google sign in process');
    
    // Set a safety timeout to hide the loading spinner after 15 seconds
    // in case the auth state change event doesn't fire
    const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout triggered - hiding loading spinner');
        hideLoading();
        showToast('Sign in process timed out. Please try again.', 'error');
    }, 15000);
    
    try {
        showLoading();
        console.log('Showing loading spinner');
        
        // Check if firebaseAuth is initialized
        if (!firebaseAuth) {
            console.error('Firebase Auth not initialized');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Authentication service not available. Please refresh the page.', 'error');
            return;
        }
        
        // Check if googleProvider is initialized
        if (!googleProvider) {
            console.error('Google Auth Provider not initialized');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Google sign-in service not available. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Calling signInWithPopup with googleProvider');
        const result = await firebaseAuth.signInWithPopup(googleProvider);
        console.log('Sign in successful, result:', result);
        clearTimeout(safetyTimeout);
    } catch (error) {
        console.error('Google sign in error:', error);
        clearTimeout(safetyTimeout);
        hideLoading();
        showToast('Error signing in with Google: ' + error.message, 'error');
    }
}

function toggleEmailAuth() {
    const form = document.getElementById('emailAuthForm');
    form.classList.toggle('hidden');
}

async function signInWithEmail() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    try {
        showLoading();
        await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        hideLoading();
        showToast('Error signing in: ' + error.message, 'error');
    }
}

async function signUpWithEmail() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showLoading();
        await firebaseAuth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
        hideLoading();
        showToast('Error creating account: ' + error.message, 'error');
    }
}

async function signOut() {
    try {
        await firebaseAuth.signOut();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        showToast('Error signing out: ' + error.message, 'error');
    }
}

// List management functions
async function loadUserLists() {
    console.log('Loading user lists for:', currentUser); console.log('Current user email:', currentUser ? currentUser.email : 'No user logged in');
    if (!currentUser) {
        console.log('No current user, returning');
        return;
    }
    
    // Set a safety timeout to hide the loading spinner after 15 seconds
    const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout triggered in loadUserLists - hiding loading spinner');
        hideLoading();
        showToast('Loading lists timed out. Please try again.', 'error');
    }, 15000);
    
    try {
        showLoading();
        
        // Check if firebaseDb is initialized
        if (!firebaseDb) {
            console.error('Firestore database not initialized');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Querying Firestore for lists owned by:', currentUser.email);
        const listsQuery = firebaseDb.collection('lists')
            .where('owner', '==', currentUser.email);
        
        const collaboratorQuery = firebaseDb.collection('lists')
            .where('collaborators', 'array-contains', currentUser.email);
        
        console.log('Fetching lists from Firestore...');
        const [ownedLists, collaboratorLists] = await Promise.all([
            listsQuery.get(),
            collaboratorQuery.get()
        ]);
        
        clearTimeout(safetyTimeout);
        
        console.log('Owned lists count:', ownedLists.size);
        console.log('Collaborator lists count:', collaboratorLists.size);
        
        const allLists = [];
        ownedLists.forEach(doc => {
            allLists.push({ id: doc.id, ...doc.data(), role: 'owner' });
        });
        
        collaboratorLists.forEach(doc => {
            if (!allLists.find(list => list.id === doc.id)) {
                allLists.push({ id: doc.id, ...doc.data(), role: 'collaborator' });
            }
        });
        userLists = allLists;
        
        console.log('Total lists to display:', allLists.length);
        displayLists(allLists);
        populateSidebarLists();
        hideLoading();
    } catch (error) {
        console.error('Error loading lists:', error);
        clearTimeout(safetyTimeout);
        hideLoading();
        showToast('Error loading lists: ' + error.message, 'error');
    }
}

function displayLists(lists) {
    const container = document.getElementById('listsContainer');
    container.innerHTML = '';
    
    if (lists.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <p>No lists found. Create your first wishlist!</p>
            </div>
        `;
        return;
    }
    
    lists.forEach(list => {
        const listCard = document.createElement('div');
        listCard.className = 'list-card';
        listCard.innerHTML = `
            <h3>${escapeHtml(list.name)}</h3>
            <p>${escapeHtml(list.description || 'No description')}</p>
            <div class="list-meta">
                <span>${list.role}</span>
                <span>${formatDate(list.eventDate)}</span>
            </div>
        `;
        
        listCard.addEventListener('click', () => {
            currentListId = list.id;
            loadList(list.id);
        });
        
        container.appendChild(listCard);
    });
}

async function createNewList() {
    const name = prompt('Enter list name:');
    if (!name) return;
    
    const eventDate = prompt('Enter event date (YYYY-MM-DD):');
    const description = prompt('Enter description (optional):') || '';
    const geminiApiKeyForList = prompt('Enter Gemini API Key for this list (optional):') || '';
    
    try {
        showLoading();
        const listData = {
            name: name,
            description: description,
            eventDate: eventDate ? new Date(eventDate).toISOString() : null,
            owner: currentUser.email,
            collaborators: [],
            viewers: [],
            isPublic: false,
            collaboratorShareAccess: true,
            geminiApiKey: geminiApiKeyForList, // Store the API key with the list
            ordered: true, // Default to ordered lists
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await firebaseDb.collection('lists').add(listData);
        currentListId = docRef.id;
        
        showToast('List created successfully!', 'success');
        loadList(docRef.id);
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('Error creating list: ' + error.message, 'error');
    }
}

async function loadList(listId) {
    // Set a safety timeout to hide the loading spinner after 15 seconds
    const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout triggered in loadList - hiding loading spinner');
        hideLoading();
        showToast('Loading list timed out. Please try again.', 'error');
    }, 15000);
    
    try {
        showLoading();
        
        // Check if firebaseDb is initialized
        if (!firebaseDb) {
            console.error('Firestore database not initialized in loadList');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Loading list with ID:', listId);
        const listDoc = await firebaseDb.collection('lists').doc(listId).get();
        
        if (!listDoc.exists) {
            console.log('List not found:', listId);
            clearTimeout(safetyTimeout);
            showToast('List not found', 'error');
            showScreen('listScreen');
            return;
        }
        
        console.log('List found, processing data');
        currentList = { id: listDoc.id, ...listDoc.data() };
        currentListId = listId;

        // Update global geminiApiKey if present in the list data
        if (currentList.geminiApiKey) {
            geminiApiKey = currentList.geminiApiKey;
            console.log('Gemini API Key loaded from list:', geminiApiKey ? 'Present' : 'Not Present');
        } else {
            geminiApiKey = ''; // Clear if not present in list
            console.log('No Gemini API Key found for this list.');
        }
        
        // Update URL without reloading
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('list', listId);
        window.history.replaceState({}, '', newUrl);
        
        displayList(currentList);
        await loadListItems(listId);
        showScreen('wishlistScreen');
        
        clearTimeout(safetyTimeout);
        hideLoading();
        console.log('List loaded successfully');
    } catch (error) {
        console.error('Error loading list:', error);
        clearTimeout(safetyTimeout);
        hideLoading();
        showToast('Error loading list: ' + error.message, 'error');
    }
}

function displayList(list) {
    document.getElementById('listTitle').textContent = list.name;
    document.getElementById('listEventDate').textContent = list.eventDate ? `Event: ${formatDate(list.eventDate)}` : '';

        // Show/hide import button based on ownership
        const importListBtn = document.getElementById('importListBtn');
        if (importListBtn) {
            if (currentUser && list.owner === currentUser.email) {
                importListBtn.style.display = 'block';
            } else {
                importListBtn.style.display = 'none';
            }
        }
    
    // Set up permissions
    const isOwner = currentUser && currentUser.email === list.owner;
    const collaboratorsField = list.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;
    
    document.getElementById('addItemBtn').style.display = canEdit ? 'flex' : 'none';
    document.getElementById('manageListBtn').style.display = isOwner ? 'flex' : 'none';
}

async function loadListItems(listId) {
    // Set a safety timeout to hide the loading spinner after 10 seconds
    const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout triggered in loadListItems - hiding loading spinner');
        hideLoading();
        showToast('Loading items timed out. Please try again.', 'error');
    }, 10000);
    
    try {
        // Check if firebaseDb is initialized
        if (!firebaseDb) {
            console.error('Firestore database not initialized in loadListItems');
            clearTimeout(safetyTimeout);
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Loading items and groups for list:', listId);
        
        // Fetch both items and groups in parallel
        const [itemsSnapshot, groupsSnapshot] = await Promise.all([
            firebaseDb.collection('lists').doc(listId).collection('items').orderBy('position', 'asc').get(),
            firebaseDb.collection('lists').doc(listId).collection('groups').get()
        ]);
        
        const items = [];
        const groups = {};
        
        itemsSnapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        groupsSnapshot.forEach(doc => {
            groups[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        console.log(`Loaded ${items.length} items and ${Object.keys(groups).length} groups for list ${listId}`);
        displayItems(items, groups);
        setupDragAndDrop();
        clearTimeout(safetyTimeout);
    } catch (error) {
        console.error('Error loading items:', error);
        clearTimeout(safetyTimeout);
        showToast('Error loading items: ' + error.message, 'error');
    }
}

function displayItems(items, groups = {}) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    // Reset selected items when redisplaying
    selectedItems = [];
    lastSelectedItemId = null;
    updateSelectionActionBar();

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <p>No items in this list yet. Add some items to get started!</p>
            </div>
        `;
        return;
    }

    // Create selection action bar
    const selectionActionBar = document.createElement('div');
    selectionActionBar.id = 'selectionActionBar';
    selectionActionBar.className = 'selection-action-bar hidden';
    selectionActionBar.innerHTML = `
        <div class="selection-info">
            <span id="selectedItemsCount">0</span> items selected
        </div>
        <div class="selection-actions">
            <button class="btn btn-secondary" id="deselectAllBtn">
                <span class="material-icons">deselect</span>
                Deselect All
            </button>
            <div class="move-to-controls" style="display:flex; gap: 8px; align-items:center; margin: 0 8px;">
                <input type="text" id="moveToPositionInput" class="input" placeholder="Move to position (e.g., 3.1 or 7)">
                <button class="btn btn-primary" id="moveToPositionBtn">
                    <span class="material-icons">swap_vert</span>
                    Move To
                </button>
            </div>
            <button class="btn btn-error" id="deleteSelectedBtn">
                <span class="material-icons">delete</span>
                Delete Selected
            </button>
        </div>
    `;
    container.appendChild(selectionActionBar);

    // Add event listeners for action bar buttons
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAllItems);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedItems);

    // Move-to-position controls
    const moveInputEl = document.getElementById('moveToPositionInput');
    const moveBtnEl = document.getElementById('moveToPositionBtn');
    if (moveBtnEl && moveInputEl) {
        moveBtnEl.addEventListener('click', async () => {
            const raw = moveInputEl.value.trim();
            if (!raw) {
                showToast('Please enter a position (e.g., 3.1 or 7)', 'warning');
                return;
            }
            try {
                await moveSelectedItemsToPosition(raw);
            } catch (err) {
                console.error('Error moving selected items:', err);
                showToast('Error moving selected items: ' + (err.message || err), 'error');
            }
        });
        moveInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                moveBtnEl.click();
            }
        });
    }

    // Prepare grouping
    const groupsMap = groups || {};
    const itemsByGroup = {};
    const ungroupedItems = [];

    items.forEach(item => {
        if (!showBoughtItems && item.bought) return; // respect bought toggle
        const gid = item.groupId || '';
        if (!gid) {
            ungroupedItems.push(item);
        } else {
            if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
            itemsByGroup[gid].push(item);
        }
    });

    // Build a map of triggerItemId -> [groupIds] to attach groups near their trigger item
    const triggerToGroups = {};
    Object.keys(groupsMap).forEach(gid => {
        const g = groupsMap[gid];
        if (g && g.triggerItemId) {
            if (!triggerToGroups[g.triggerItemId]) triggerToGroups[g.triggerItemId] = [];
            triggerToGroups[g.triggerItemId].push(gid);
        }
    });

    const renderedGroups = new Set();

    // Composite numbering support for groups (display-only)
    const groupDisplayIndex = {};
    let nextGroupNumber = 1;

    function isGroupVisible(group) {
        if (!group) return true;
        if (group.conditionalVisibility && group.triggerItemId) {
            const triggerItem = items.find(it => it.id === group.triggerItemId);
            return !!(triggerItem && triggerItem.bought);
        }
        return true;
    }

    function renderGroupBlock(groupId) {
        if (renderedGroups.has(groupId)) return;
        const group = groupsMap[groupId];
        if (!group) {
            console.warn(`Group ${groupId} not found, skipping render`);
            return;
        }
        const groupItems = itemsByGroup[groupId] || [];
        if (!isGroupVisible(group)) return; // respect conditional visibility

        // Group container
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';
        groupContainer.dataset.groupId = groupId;

        const isOwner = currentUser && currentUser.email === currentList.owner;
        const collaboratorsField = currentList.collaborators || [];
        const isCollaborator = currentUser && (
            Array.isArray(collaboratorsField)
                ? collaboratorsField.includes(currentUser.email)
                : typeof collaboratorsField === 'object' && collaboratorsField !== null
                    ? Object.values(collaboratorsField).includes(currentUser.email)
                    : false
        );
        const canEdit = isOwner || isCollaborator;

        // Group header
        const header = document.createElement('div');
        header.className = 'group-header';
        const groupImg = group.imageUrl ? `<img src="${group.imageUrl}" alt="${escapeHtml(group.name || 'Group')}" class="group-image" onerror="this.style.display='none'">` : '';
        const displayNo = groupDisplayIndex[groupId] || nextGroupNumber;
        const groupName = group.name || 'Untitled Group';
        const groupDescription = group.description || '';
        header.innerHTML = `
            ${groupImg}
            <div class="group-header-text">
                <h3 class="group-title"><span class="group-number">${displayNo}.</span> ${escapeHtml(groupName)}</h3>
                ${groupDescription ? `<p class="group-description">${escapeHtml(groupDescription)}</p>` : ''}
            </div>
            <div class="group-actions">
                ${canEdit ? `
                    <button class="icon-button" onclick="editGroup('${groupId}')" title="Edit Group">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="icon-button" onclick="deleteGroup('${groupId}', '${escapeHtml(groupName)}')" title="Delete Group">
                        <span class="material-icons">delete</span>
                    </button>
                ` : ''}
                <button class="icon-button" onclick="showGroupInfo('${groupId}')" title="Group Info">
                    <span class="material-icons">info</span>
                </button>
            </div>
        `;
        groupContainer.appendChild(header);

        // Assign group display number if first time rendering
        if (!groupDisplayIndex[groupId]) {
            groupDisplayIndex[groupId] = nextGroupNumber++;
        }
        groupContainer.dataset.groupDisplayNumber = groupDisplayIndex[groupId];

        // Group items
        groupItems.forEach((item, idx) => {
            const compositeLabel = `${groupDisplayIndex[groupId]}.${idx + 1}`;
            const itemCard = createItemCard(item, compositeLabel);
            groupContainer.appendChild(itemCard);
        });

        container.appendChild(groupContainer);
        renderedGroups.add(groupId);
    }

    // Render ungrouped items first; attach any groups triggered by each item directly after
    if (ungroupedItems.length > 0) {
        ungroupedItems.forEach((item, idx) => {
            const itemCard = createItemCard(item, idx + 1);
            container.appendChild(itemCard);

            const groupsTriggered = triggerToGroups[item.id] || [];
            groupsTriggered.forEach(gid => {
                const g = groupsMap[gid];
                // If conditional is off, always attach; if on, attach only when visible (trigger item bought)
                if (!g || !g.conditionalVisibility || isGroupVisible(g)) {
                    renderGroupBlock(gid);
                }
            });
        });
    }

    // Render any remaining groups not yet rendered (e.g., groups without triggers or triggers not currently in view)
    Object.keys(itemsByGroup).forEach(groupId => {
        if (renderedGroups.has(groupId)) return;
        const group = groupsMap[groupId];
        if (group && isGroupVisible(group)) {
            renderGroupBlock(groupId);
        }
    });
}

function createItemCard(item, position) {
    const card = document.createElement('div');
    card.className = `item-card ${item.bought ? 'bought' : ''} ${selectedItems.includes(item.id) ? 'selected' : ''}`;
    card.dataset.itemId = item.id;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;
    
    // Create checkbox for multi-select
    const checkbox = document.createElement('div');
    checkbox.className = 'item-checkbox';
    checkbox.innerHTML = `<input type="checkbox" ${selectedItems.includes(item.id) ? 'checked' : ''} />`;
    
    // Add checkbox click handler with support for Ctrl and Shift selection
    const checkboxInput = checkbox.querySelector('input');
    checkboxInput.addEventListener('click', (e) => {
        e.stopPropagation();
        handleItemSelection(item.id, e.ctrlKey, e.shiftKey);
    });



    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'item-content-wrapper';
    
    // Add click event listener to handle selection and show info modal
    contentWrapper.addEventListener('click', (e) => {
        // Don't trigger if clicking on a button or link
        if (!e.target.closest('button') && !e.target.closest('a')) {
            if (e.ctrlKey || e.shiftKey) {
                handleItemSelection(item.id, e.ctrlKey, e.shiftKey);
            } else {
                showItemInfo(item.id);
            }
        }
    });
    
    const showPosition = !currentList || currentList.ordered !== false;
    contentWrapper.innerHTML = `
        <div class="item-position" style="${showPosition ? '' : 'display:none;'}">${position}</div>
        <div class="item-header">
            <h3 class="item-title">${escapeHtml(item.name)}</h3>
            <div class="item-actions">
                ${canEdit ? `
                    <button class="icon-button" onclick="deleteItem('${item.id}', '${escapeHtml(item.name)}')" title="Delete">
                        <span class="material-icons">delete</span>
                    </button>
                ` : ''}
                ${canEdit ? `
                    <button class="icon-button" onclick="editItem('${item.id}')" title="Edit">
                        <span class="material-icons">edit</span>
                    </button>
                ` : ''}
                <button class="icon-button" onclick="showItemInfo('${item.id}')" title="Info">
                    <span class="material-icons">info</span>
                </button>
                ${item.url ? `
                    <button class="icon-button" onclick="openItemLink('${item.url}')" title="Open link">
                        <span class="material-icons">open_in_new</span>
                    </button>
                ` : ''}
                ${!item.bought ?
 `
                    <button class="icon-button" onclick="markAsBought('${item.id}')" title="Mark as bought">
                        <span class="material-icons">shopping_cart</span>
                    </button>
                ` : ''}
                ${canEdit ? `
                    <button class="icon-button" onclick="deleteItem('${item.id}', '${escapeHtml(item.name)}')" title="Delete">
                        <span class="material-icons">delete</span>
                    </button>
                ` : ''}
                ${canEdit ? `
                    <button class="icon-button drag-handle" title="Drag to reorder">
                        <span class="material-icons">drag_indicator</span>
                    </button>
                    <button class="icon-button" onclick="deleteItem('${item.id}', '${escapeHtml(item.name)}')" title="Delete">
                        <span class="material-icons">delete</span>
                    </button>
                ` : ''}
            </div>
        </div>
        <div class="item-content">
            ${item.imageUrl ? `
                <img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" class="item-image" 
                     onerror="this.style.display='none'">
            ` : ''}
            <div class="item-details">
                ${item.description ? `
                    <p class="item-description">${escapeHtml(item.description)}</p>
                ` : ''}
                ${item.notes ? `
                    <div class="item-notes">${marked.parse(item.notes)}</div>
                ` : ''}
                <div class="item-meta">
                    ${item.price ? `<span class="item-price">$${item.price}</span>` : ''}
                    ${item.bought && item.buyerName ? `
                        <span>Bought by: ${escapeHtml(item.buyerName)}</span>
                    ` : ''}
                </div>
            </div>
        </div>
        ${item.bought && showBoughtItems ? `
            <div class="bought-info">
                <h4>Purchase Information</h4>
                <p><strong>Buyer:</strong> ${escapeHtml(item.buyerName || 'Unknown')}</p>
                ${item.buyerEmail ? `
                    <p><strong>Contact:</strong> 
                        <a href="mailto:${item.buyerEmail}">${item.buyerEmail}</a>
                    </p>
                ` : ''}
                ${item.buyerNote ? `
                    <p><strong>Note:</strong> ${escapeHtml(item.buyerNote)}</p>
                ` : ''}
                <p><strong>Date:</strong> ${formatDate(item.datePurchased)}</p>
                <button class="btn btn-secondary" onclick="markAsNotBought('${item.id}')">
                    <span class="material-icons">remove_shopping_cart</span>
                    Mark as Not Bought
                </button>
            </div>
        ` : ''}
    `;
    
    // Append elements to card
    card.appendChild(checkbox);
    card.appendChild(contentWrapper);
    
    return card;
}

// Group functions (placeholders for now)
function editGroup(groupId) {
    console.log('Edit group:', groupId);
    // Implement actual edit logic later
}

function deleteGroup(groupId, groupName) {
    console.log('Delete group:', groupId, groupName);
    // Implement actual delete logic later
}

function showGroupInfo(groupId) {
    console.log('Show group info:', groupId);
    // Implement actual info display logic later
}

// Multi-select functionality
function handleItemSelection(itemId, ctrlKey, shiftKey) {
    // Get all visible item IDs in order
    const visibleItemIds = Array.from(document.querySelectorAll('.item-card'))
        .map(card => card.dataset.itemId);
    
    if (shiftKey && lastSelectedItemId) {
        // Shift key: select range of items
        const currentIndex = visibleItemIds.indexOf(itemId);
        const lastIndex = visibleItemIds.indexOf(lastSelectedItemId);
        
        if (currentIndex !== -1 && lastIndex !== -1) {
            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);
            
            // Clear selection if not holding Ctrl key
            if (!ctrlKey) {
                selectedItems = [];
            }
            
            // Add all items in range to selection
            for (let i = start; i <= end; i++) {
                if (!selectedItems.includes(visibleItemIds[i])) {
                    selectedItems.push(visibleItemIds[i]);
                }
            }
        }
    } else if (ctrlKey) {
        // Ctrl key: toggle selection of clicked item
        const index = selectedItems.indexOf(itemId);
        if (index === -1) {
            selectedItems.push(itemId);
        } else {
            selectedItems.splice(index, 1);
        }
    } else {
        // No modifier keys: select only this item
        if (selectedItems.length === 1 && !selectedItems.includes(itemId)) {
            // If exactly one item is selected and a different item is clicked, add the new item.
            selectedItems.push(itemId);
        } else if (selectedItems.includes(itemId) && selectedItems.length === 1) {
            // If the single selected item is clicked again, deselect it.
            selectedItems = [];
        } else {
            // Otherwise, clear selection and select only this item.
            selectedItems = [itemId];
        }
    }
    
    // Update last selected item
    lastSelectedItemId = itemId;
    
    // Update UI to reflect selection state
    updateSelectionUI();
    updateSelectionActionBar();
}

function updateSelectionUI() {
    // Update all item cards to reflect selection state
    document.querySelectorAll('.item-card').forEach(card => {
        const itemId = card.dataset.itemId;
        const isSelected = selectedItems.includes(itemId);
        
        // Update card class
        if (isSelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
        
        // Update checkbox
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = isSelected;
        }
    });
}

function updateSelectionActionBar() {
    const actionBar = document.getElementById('selectionActionBar');
    if (!actionBar) return;
    
    if (selectedItems.length > 0) {
        actionBar.classList.remove('hidden');
        document.getElementById('selectedItemsCount').textContent = selectedItems.length;
    } else {
        actionBar.classList.add('hidden');
    }
}

function deselectAllItems() {
    selectedItems = [];
    lastSelectedItemId = null;
    updateSelectionUI();
    updateSelectionActionBar();
}

async function deleteSelectedItems() {
    if (selectedItems.length === 0) return;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;
    
    if (!canEdit) {
        showToast('You don\'t have permission to delete items', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} selected item(s)?`)) {
        return;
    }
    
    showLoading();
    
    try {
        const batch = firebaseDb.batch();
        const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
        
        selectedItems.forEach(itemId => {
            batch.delete(itemsRef.doc(itemId));
        });
        
        await batch.commit();
        showToast(`${selectedItems.length} item(s) deleted successfully`, 'success');
        
        // Clear selection and reload items
        selectedItems = [];
        lastSelectedItemId = null;
        await loadListItems(currentListId); // Ensure list is reloaded before hiding loading
        hideLoading();
    } catch (error) {
        console.error('Error deleting items:', error);
        showToast('Error deleting items: ' + error.message, 'error');
        hideLoading();
    }
}

// Move a contiguous block (the currently selected items) to a target position.
// rawPosition supports composite (e.g., "3.1") or absolute numbers (e.g., "7").
// The relative order of the selected items is preserved.
async function moveSelectedItemsToPosition(rawPosition) {
    if (!currentListId) {
        showToast('No active list selected', 'error');
        return;
    }

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
        showToast('No items selected to move', 'warning');
        return;
    }

    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;

    if (!canEdit) {
        showToast('You don\'t have permission to move items', 'error');
        return;
    }

    showLoading();
    try {
        const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
        // Determine the base absolute insertion position for a single item at the requested spot
        const baseAbsolute = await parseCompositeOrAbsolutePosition(String(rawPosition || '').trim(), itemsRef);

        // Fetch the current ordering
        const snap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        snap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));

        // Selected items in current order
        const selectedSet = new Set(selectedItems);
        const selectedOrdered = allItems.filter(it => selectedSet.has(it.id));
        if (selectedOrdered.length === 0) {
            showToast('No matching selected items found to move', 'warning');
            hideLoading();
            return;
        }

        // Non-selected items in current order
        const others = allItems.filter(it => !selectedSet.has(it.id));

        // Map the requested absolute index to an insertion index in the "others" array
        let insertionIndex = others.length; // default append
        if (baseAbsolute <= allItems.length) {
            const targetAllIdx = Math.max(0, baseAbsolute - 1);
            const targetItemId = allItems[targetAllIdx]?.id;
            // Try to locate this target among non-selected items
            const idxInOthers = targetItemId ? others.findIndex(it => it.id === targetItemId) : -1;
            if (idxInOthers !== -1) {
                insertionIndex = idxInOthers;
            } else {
                // If target points to a selected item, find the next non-selected item after it
                let foundIdx = -1;
                for (let i = targetAllIdx; i < allItems.length; i++) {
                    const id = allItems[i].id;
                    const j = others.findIndex(it => it.id === id);
                    if (j !== -1) { foundIdx = j; break; }
                }
                // If none found, insert at end
                insertionIndex = foundIdx !== -1 ? foundIdx : others.length;
            }
        } else {
            // baseAbsolute === allItems.length + 1 (append)
            insertionIndex = others.length;
        }

        // Build the new total order: others before insertion, then selected block, then the rest
        const newOrder = [
            ...others.slice(0, insertionIndex),
            ...selectedOrdered,
            ...others.slice(insertionIndex)
        ];

        // Write back positions in a single batch
        const batch = firebaseDb.batch();
        newOrder.forEach((it, idx) => {
            batch.update(itemsRef.doc(it.id), {
                position: idx + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        showToast(`Moved ${selectedOrdered.length} item(s) to position ${String(rawPosition).trim()}`, 'success');
        // Reload items to reflect new order
        await loadListItems(currentListId);
    } catch (err) {
        console.error('Error moving selected items:', err);
        showToast('Error moving selected items: ' + (err.message || err), 'error');
    } finally {
        hideLoading();
    }
}

function setupDragAndDrop() {
    const container = document.getElementById('itemsContainer');
    if (container.children.length === 0) return;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;
    
    if (!canEdit) return;
    
    new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        filter: '.selection-action-bar', // Don't allow dragging the action bar
        onEnd: async function(evt) {
            const itemId = evt.item.dataset.itemId;
            const newPosition = evt.newIndex + 1;
            
            try {
                await updateItemPosition(itemId, newPosition);
                showToast('Item position updated', 'success');
            } catch (error) {
                showToast('Error updating position: ' + error.message, 'error');
                // Reload items to reset positions
                loadListItems(currentListId);
            }
        }
    });
}

// Function to populate the group selector in the item modal
function populateGroupSelector() {
    const groupSelect = document.getElementById('itemGroup');
    if (!groupSelect) {
        console.error('Group select element not found');
        return;
    }

    // Clear existing options except the default
    groupSelect.innerHTML = '<option value="">No Group</option>';

    if (!currentListId) {
        console.log('No current list ID, cannot populate group selector');
        return;
    }

    // Fetch groups from Firestore
    firebaseDb.collection('lists').doc(currentListId).collection('groups')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('No groups found for this list');
                return;
            }

            snapshot.forEach(doc => {
                const group = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = group.name || 'Unnamed Group';
                groupSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching groups:', error);
        });
}

// Item management functions
function showAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Add Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemForm').dataset.mode = 'add';
    
    // Clear description and notes fields
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemNotes').value = '';

    // Populate group selector
    populateGroupSelector();

    const itemNameInput = document.getElementById('itemName');
    let typingTimer;
    const doneTypingInterval = 1000; // 1 second

    // Define the event handler function
    const handleItemNameInputEvent = () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            const itemName = itemNameInput.value.trim();
            if (itemName) {
                showLoading();
                const { generatedName, description, notes } = await summarizeItemName(itemName);
                document.getElementById('itemName').value = generatedName; // Update the item name input
                document.getElementById('itemDescription').value = description;
                document.getElementById('itemNotes').value = notes;
                hideLoading();
            }
        }, doneTypingInterval);
    };

    // Remove any existing listeners to prevent duplicates before adding new ones
    itemNameInput.removeEventListener('input', itemNameInput._handleItemNameInputEvent);
    itemNameInput.removeEventListener('blur', itemNameInput._handleItemNameInputEvent);

    // Store the function reference on the element itself to allow removal later
    itemNameInput._handleItemNameInputEvent = handleItemNameInputEvent;

    // Add event listeners
    itemNameInput.addEventListener('input', itemNameInput._handleItemNameInputEvent);
    itemNameInput.addEventListener('blur', itemNameInput._handleItemNameInputEvent);

    showModal('itemModal');
}

// Group management functions
function showAddGroupModal() {
    const groupForm = document.getElementById('groupForm');
    if (!groupForm) {
        console.error('Group form not found');
        return;
    }
    document.getElementById('groupModalTitle').textContent = 'Add Group';
    groupForm.reset();
    groupForm.dataset.mode = 'add';
    delete groupForm.dataset.groupId;

    const conditionalItemSelector = document.getElementById('conditionalItemSelector');
    const conditionalCheckbox = document.getElementById('groupConditionalVisibility');

    if (conditionalItemSelector && conditionalCheckbox) {
        // Initialize visibility
        conditionalItemSelector.style.display = conditionalCheckbox.checked ? 'block' : 'none';
        // Set up change handler (replace previous to avoid duplicates)
        conditionalCheckbox.onchange = function() {
            if (this.checked) {
                conditionalItemSelector.style.display = 'block';
                populateItemSelector();
            } else {
                conditionalItemSelector.style.display = 'none';
            }
        };
    }

    // Populate items for trigger selector
    populateItemSelector();

    showModal('groupModal');
}

function populateItemSelector() {
    try {
        const selector = document.getElementById('groupTriggerItem');
        if (!selector) return;
        selector.innerHTML = '<option value="">Select an item...</option>';
        if (!currentListId) return;
        firebaseDb.collection('lists').doc(currentListId).collection('items')
            .orderBy('position')
            .get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = data.name || 'Untitled';
                    selector.appendChild(opt);
                });
            })
            .catch(err => console.error('Error populating item selector:', err));
    } catch (e) {
        console.error('populateItemSelector error:', e);
    }
}

async function saveGroup() {
    const name = document.getElementById('groupName').value.trim();
    const imageUrl = document.getElementById('groupImageURL').value.trim();
    const description = document.getElementById('groupDescription').value.trim();
    const notes = document.getElementById('groupNotes').value.trim();
    const conditional = document.getElementById('groupConditionalVisibility').checked;
    const triggerItemId = document.getElementById('groupTriggerItem').value || null;
    const autoBuy = document.getElementById('groupAutoBuy').checked;

    if (!name) {
        showToast('Group name is required', 'error');
        return;
    }
    if (conditional && !triggerItemId) {
        showToast('Please select a trigger item for conditional visibility', 'error');
        return;
    }

    try {
        showLoading();
        const groupData = {
            name,
            imageUrl: imageUrl || null,
            description: description || null,
            notes: notes || null,
            conditionalVisibility: conditional || false,
            triggerItemId: conditional ? triggerItemId : null,
            autoBuy: autoBuy || false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const groupRef = firebaseDb.collection('lists').doc(currentListId).collection('groups');

        const form = document.getElementById('groupForm');
        if (form.dataset.mode === 'edit' && form.dataset.groupId) {
            const { createdAt, ...updateData } = groupData;
            await groupRef.doc(form.dataset.groupId).update(updateData);
            showToast('Group updated!', 'success');
        } else {
            await groupRef.add(groupData);
            showToast('Group added!', 'success');
        }

        hideModal('groupModal');
        // Refresh items view (groups rendering to be added in next steps)
        await loadListItems(currentListId);
    } catch (err) {
        console.error('Error saving group:', err);
        showToast('Error saving group: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function editItem(itemId) {
    // Find item in current list and load it into the edit modal
    const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
    
    itemsRef.doc(itemId).get()
        .then(doc => {
            if (doc.exists) {
                const item = doc.data();
                // Set the form to edit mode and store the item ID
                document.getElementById('itemForm').dataset.mode = 'edit';
                document.getElementById('itemForm').dataset.itemId = itemId;
                
                // Set modal title
                document.getElementById('itemModalTitle').textContent = 'Edit Item';
                
                // Populate form fields
                document.getElementById('itemName').value = item.name || '';
                document.getElementById('itemURL').value = item.url || '';
                document.getElementById('itemDescription').value = item.description || '';
                document.getElementById('itemImageURL').value = item.imageUrl || '';
                document.getElementById('itemNotes').value = item.notes || '';
                document.getElementById('itemPrice').value = item.price || '';
                document.getElementById('itemPosition').value = item.position || '';
                
                // Populate group selector and preselect current group
                populateGroupSelector();
                
                // Set group selection after async population
                setTimeout(() => {
                    const groupSelect = document.getElementById('itemGroup');
                    if (groupSelect && item.groupId) {
                        groupSelect.value = item.groupId;
                    }
                }, 100);
                
                // Show the modal
                showModal('itemModal');
            } else {
                showToast('Item not found', 'error');
            }
        })
        .catch(error => {
            console.error('Error getting item:', error);
            showToast('Error loading item data', 'error');
        });
}

function showItemInfo(itemId) {
    // Find the item in the current list items
    const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
    itemsRef.doc(itemId).get()
        .then(doc => {
            if (doc.exists) {
                const item = { id: doc.id, ...doc.data() };
                showInfoModal(item);
            } else {
                showToast('Item not found', 'error');
            }
        })
        .catch(error => {
            console.error('Error getting item:', error);
            showToast('Error loading item details', 'error');
        });
}

function openItemLink(url) {
    if (url.startsWith('mailto:')) {
        window.location.href = url;
    } else {
        window.open(url, '_blank');
    }
}

async function markAsBought(itemId) {
    // Open modal-based flow instead of prompt-based
    showBuyModal(itemId);
}

function showBuyModal(itemId) {
    const modal = document.getElementById('buyModal');
    if (!modal) {
        showToast('Buy modal not found', 'error');
        return;
    }
    // Store the itemId on the modal element
    modal.dataset.itemId = itemId;

    // Prefill inputs if possible
    const nameInput = document.getElementById('buyerNameInput');
    const emailInput = document.getElementById('buyerEmailInput');
    const noteInput = document.getElementById('buyerNoteInput');

    if (nameInput) {
        const fallbackName = currentUser && (currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : ''));
        nameInput.value = fallbackName || '';
        nameInput.focus();
    }
    if (emailInput) {
        emailInput.value = (currentUser && currentUser.email) ? currentUser.email : '';
    }
    if (noteInput) {
        noteInput.value = '';
    }

    showModal('buyModal');
}

async function confirmBuy() {
    const modal = document.getElementById('buyModal');
    const itemId = modal && modal.dataset ? modal.dataset.itemId : null;

    const nameInput = document.getElementById('buyerNameInput');
    const emailInput = document.getElementById('buyerEmailInput');
    const noteInput = document.getElementById('buyerNoteInput');

    const buyerName = nameInput ? nameInput.value.trim() : '';
    const buyerEmail = emailInput ? emailInput.value.trim() : '';
    const buyerNote = noteInput ? noteInput.value.trim() : '';

    if (!itemId) {
        showToast('No item selected for purchase', 'error');
        return;
    }
    if (!buyerName) {
        showToast('Please enter your name to confirm purchase', 'error');
        if (nameInput) nameInput.focus();
        return;
    }

    try {
        await performBuy(itemId, buyerName, buyerEmail, buyerNote);
        hideModal('buyModal');
    } catch (err) {
        // performBuy already shows a toast; keep modal open for correction
        console.error('Confirm buy error:', err);
    }
}

async function performBuy(itemId, buyerName, buyerEmail, buyerNote) {
    try {
        // First, get the item to check its group
        const itemDoc = await firebaseDb.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).get();
        
        if (!itemDoc.exists) {
            showToast('Item not found', 'error');
            return;
        }
        
        const item = itemDoc.data();
        
        // Mark the current item as bought
        await firebaseDb.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).update({
                bought: true,
                buyerName: buyerName,
                buyerEmail: buyerEmail,
                buyerNote: buyerNote,
                datePurchased: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Check if item belongs to a group with auto-buy enabled
        if (item.groupId) {
            const groupDoc = await firebaseDb.collection('lists').doc(currentListId)
                .collection('groups').doc(item.groupId).get();
            
            if (groupDoc.exists && groupDoc.data().autoBuy) {
                // Get all items in this group that are not yet bought
                const groupItemsSnapshot = await firebaseDb.collection('lists').doc(currentListId)
                    .collection('items')
                    .where('groupId', '==', item.groupId)
                    .where('bought', '==', false)
                    .get();
                
                // Mark all other items in the group as bought
                const batch = firebase.firestore().batch();
                groupItemsSnapshot.forEach(doc => {
                    if (doc.id !== itemId) { // Don't update the item we just bought
                        const itemRef = firebaseDb.collection('lists').doc(currentListId)
                            .collection('items').doc(doc.id);
                        batch.update(itemRef, {
                            bought: true,
                            buyerName: buyerName + ' (Auto-buy)',
                            buyerEmail: buyerEmail,
                            buyerNote: 'Automatically marked as bought due to group auto-buy setting',
                            datePurchased: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                });
                
                if (!groupItemsSnapshot.empty) {
                    await batch.commit();
                    showToast(`Item and ${groupItemsSnapshot.size - 1} other group items marked as bought!`, 'success');
                } else {
                    showToast('Item marked as bought!', 'success');
                }
                
            } else {
                showToast('Item marked as bought!', 'success');
            }
        } else {
            showToast('Item marked as bought!', 'success');
        }
        
        loadListItems(currentListId);
    } catch (error) {
        showToast('Error marking item as bought: ' + error.message, 'error');
        throw error;
    }
}

async function markAsNotBought(itemId) {
    if (!confirm('Are you sure you want to mark this item as not bought? This will remove all purchase information.')) {
        return;
    }
    
    try {
        await firebaseDb.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).update({
                bought: false,
                buyerName: firebase.firestore.FieldValue.delete(),
                buyerEmail: firebase.firestore.FieldValue.delete(),
                buyerNote: firebase.firestore.FieldValue.delete(),
                datePurchased: firebase.firestore.FieldValue.delete()
            });
        
        showToast('Item marked as not bought!', 'success');
        loadListItems(currentListId);
    } catch (error) {
        showToast('Error marking item as not bought: ' + error.message, 'error');
    }
}

async function parseCompositeOrAbsolutePosition(raw, itemsRef) {
    try {
        // Fetch all items ordered by position
        const itemsSnap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        itemsSnap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));
        const totalCount = allItems.length;

        const trimmed = (raw || '').trim();
        if (!trimmed) {
            return totalCount + 1; // default append
        }
        // Absolute numeric position
        if (/^\d+$/.test(trimmed)) {
            const n = parseInt(trimmed, 10);
            return Math.max(1, Math.min(n, totalCount + 1));
        }
        // Composite pattern G.I
        const m = trimmed.match(/^(\d+)\.(\d+)$/);
        if (!m) {
            // Unrecognized input -> append at end
            return totalCount + 1;
        }
        let groupNumber = parseInt(m[1], 10);
        let itemIndexInGroup = parseInt(m[2], 10);
        if (groupNumber < 1 || itemIndexInGroup < 1) {
            return totalCount + 1;
        }

        // Build groups map
        const groupsSnap = await firebaseDb.collection('lists').doc(currentListId).collection('groups').get();
        const groupsMap = {};
        groupsSnap.forEach(doc => { groupsMap[doc.id] = { id: doc.id, ...doc.data() }; });

        // Build visible items similar to displayItems()
        const items = [];
        allItems.forEach(it => {
            if (!showBoughtItems && it.bought) return; // respect toggle
            items.push(it);
        });

        const itemsByGroup = {};
        const ungroupedItems = [];
        items.forEach(it => {
            const gid = it.groupId || '';
            if (!gid) ungroupedItems.push(it);
            else {
                if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
                itemsByGroup[gid].push(it);
            }
        });

        // trigger -> groups
        const triggerToGroups = {};
        Object.keys(groupsMap).forEach(gid => {
            const g = groupsMap[gid];
            if (g && g.triggerItemId) {
                if (!triggerToGroups[g.triggerItemId]) triggerToGroups[g.triggerItemId] = [];
                triggerToGroups[g.triggerItemId].push(gid);
            }
        });

        function isGroupVisible(group) {
            if (!group) return true;
            if (group.conditionalVisibility && group.triggerItemId) {
                const triggerItem = items.find(it => it.id === group.triggerItemId);
                return !!(triggerItem && triggerItem.bought);
            }
            return true;
        }

        // Build the visible sequence and assign display group numbers in render order
        const visibleSequence = []; // items in the order they are shown
        const groupDisplayIndex = {};
        let nextGroupNumber = 1;
        const renderedGroups = new Set();
        const groupStartIndex = {}; // gid -> start index within visibleSequence

        function renderGroupBlock(gid) {
            if (renderedGroups.has(gid)) return;
            const group = groupsMap[gid];
            const groupItems = itemsByGroup[gid] || [];
            if (!isGroupVisible(group)) return;
            if (!groupDisplayIndex[gid]) groupDisplayIndex[gid] = nextGroupNumber++;
            groupStartIndex[gid] = visibleSequence.length;
            groupItems.forEach(it => visibleSequence.push(it));
            renderedGroups.add(gid);
        }

        // Render ungrouped items and any triggered groups after each
        ungroupedItems.forEach(it => {
            visibleSequence.push(it);
            const groupsTriggered = triggerToGroups[it.id] || [];
            groupsTriggered.forEach(gid => {
                const g = groupsMap[gid];
                if (!g || !g.conditionalVisibility || isGroupVisible(g)) {
                    renderGroupBlock(gid);
                }
            });
        });

        // Render remaining groups (e.g., without triggers)
        Object.keys(itemsByGroup).forEach(gid => {
            if (renderedGroups.has(gid)) return;
            const g = groupsMap[gid];
            if (isGroupVisible(g)) renderGroupBlock(gid);
        });

        // Locate the real group id by its display number
        const targetGid = Object.keys(groupDisplayIndex).find(gid => groupDisplayIndex[gid] === groupNumber);
        if (!targetGid) return totalCount + 1; // append if not found

        const start = groupStartIndex[targetGid] ?? -1;
        const len = (itemsByGroup[targetGid] || []).length;
        if (start < 0) return totalCount + 1;

        // Clamp item index to [1..len+1] to allow placing after group
        if (itemIndexInGroup > len + 1) itemIndexInGroup = len + 1;

        // Determine target visible index (0-based)
        const targetVisibleIndex = start + (itemIndexInGroup - 1);
        if (itemIndexInGroup <= len) {
            const targetItemId = visibleSequence[targetVisibleIndex]?.id;
            const idxInAll = allItems.findIndex(it => it.id === targetItemId);
            return Math.max(1, Math.min(idxInAll + 1, totalCount + 1));
        } else {
            // After last item in the group
            if (len > 0) {
                const lastItemId = (itemsByGroup[targetGid][len - 1]).id;
                const idxInAll = allItems.findIndex(it => it.id === lastItemId);
                return Math.max(1, Math.min(idxInAll + 2, totalCount + 1));
            } else {
                // Empty group, place at end as fallback
                return totalCount + 1;
            }
        }
    } catch (err) {
        console.error('Error parsing position input:', err);
        // Fallback to append
        const snap = await itemsRef.get();
        return snap.size + 1;
    }
}

async function saveItem() {
    const form = document.getElementById('itemForm');
    const formData = new FormData(form);

    // Determine desired absolute position from input; support composite like "G.I" or absolute numbers; default to append at end
    const posInputEl = document.getElementById('itemPosition');
    const rawPos = posInputEl ? (posInputEl.value || '').trim() : '';
    const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
    const desiredPosition = await parseCompositeOrAbsolutePosition(rawPos, itemsRef);
    
    const itemData = {
        name: document.getElementById('itemName').value,
        url: document.getElementById('itemURL').value,
        description: document.getElementById('itemDescription').value,
        imageUrl: document.getElementById('itemImageURL').value,
        notes: document.getElementById('itemNotes').value,
        price: document.getElementById('itemPrice').value || null,
        position: desiredPosition,
        bought: false,
        groupId: document.getElementById('itemGroup').value || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (!itemData.name) {
        showToast('Item name is required', 'error');
        return;
    }
    
    try {
        showLoading();
        
        if (form.dataset.mode === 'add') {
            await firebaseDb.collection('lists').doc(currentListId)
                .collection('items').add(itemData);
            showToast('Item added successfully!', 'success');
        } else {
            // Edit mode - update existing item
            const itemId = form.dataset.itemId;
            
            // Don't override creation date for edits
            delete itemData.createdAt;
            
            // Include groupId when updating; only update position if user provided a position input
            itemData.groupId = document.getElementById('itemGroup').value || null;
            if (!rawPos) {
                delete itemData.position;
            }
            await firebaseDb.collection('lists').doc(currentListId)
                .collection('items').doc(itemId).update(itemData);
            showToast('Item updated successfully!', 'success');
        }
        
        hideModal('itemModal');
        loadListItems(currentListId);
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('Error saving item: ' + error.message, 'error');
    }
}

async function updateItemPosition(itemId, newPosition) {
    // Allow composite (e.g., "3.2") or absolute; convert to absolute then clamp to [1, last+1]
    const itemsRef = firebaseDb.collection('lists').doc(currentListId).collection('items');
    let absolute = typeof newPosition === 'number' ? newPosition : await parseCompositeOrAbsolutePosition(String(newPosition || '').trim(), itemsRef);
    const snap = await itemsRef.get();
    const clamped = Math.max(1, Math.min(absolute, snap.size + 1));
    await itemsRef.doc(itemId).update({
        position: clamped,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Settings functions
function saveSettings() {
    // Gemini API Key is now stored per list, so no global saving here
    showToast('Settings saved!', 'success');
    hideModal('settingsModal');
}

// Function to load settings on app initialization
function loadSettings() {
    // Gemini API Key is loaded from the current list, not global settings
    const apiKeyInput = document.getElementById('geminiApiKey');
    if (apiKeyInput) {
        apiKeyInput.value = geminiApiKey; // Use the globally set geminiApiKey (from current list)
    }
}
// Initialize Gemini API
async function summarizeItemName(itemName, apiKey) {
    const keyToUse = apiKey || localStorage.getItem('geminiApiKey');
    if (!keyToUse) {
        console.warn('Gemini API Key not set. Cannot generate item details.');
        return { description: "", notes: "" };
    }

    try {
        console.log(`Generating details for item: ${itemName} using Gemini API`);

        const PROMPT = `Generate info for the following item. Make a name that is just a few words. make the description a short 1 or less sentance about twhat the product is. make the notes some of the features or other models that are cheaper, etc. Use the provided example as a reference for style and content structure. Ensure notes are in Markdown format for links.

Example:
Item Name: Insta360 X5
Description: The newest 360 Camera from Insta 360. Similar to GoPro, but records all angles.
Notes: The [Insta360 X4](https://share.google/hzIG76Kf5MtnCNikb) is a cheaper alternative.

Generate for:
Item Name: "${itemName}"
Item Name:
Description:
Notes:`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${keyToUse}`;

        const body = {
            contents: [
                {
                    parts: [
                        { text: PROMPT }
                    ]
                }
            ]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        // Parse the generated text into description and notes
        const nameMatch = generatedText.match(/Item Name:\s*([\s\S]*?)(?:\nDescription:|$)/i);
        const descriptionMatch = generatedText.match(/Description:\s*([\s\S]*?)(?:\nNotes:|$)/i);
        const notesMatch = generatedText.match(/Notes:\s*([\s\S]*)/i);

        const generatedName = nameMatch ? nameMatch[1].trim() : "Ai Did not provide a name"; // Fallback to original itemName if AI doesn't provide a name
        const description = descriptionMatch ? descriptionMatch[1].trim() : "";
        const notes = notesMatch ? notesMatch[1].trim() : "";

        return { generatedName, description, notes };

    } catch (error) {
        console.error(`Error generating details for ${itemName} with Gemini API:`, error);
        return { description: "", notes: "" }; // Return empty details on error
    }
}


// Share functions
function setupShareButtons() {
    console.log('Setting up share buttons');
    try {
        const copyViewerLink = document.getElementById('copyViewerLink');
        if (copyViewerLink) {
            copyViewerLink.addEventListener('click', () => copyShareLink('viewer'));
        } else {
            console.error('Element not found: copyViewerLink');
        }
        
        const copyCollabLink = document.getElementById('copyCollabLink');
        if (copyCollabLink) {
            copyCollabLink.addEventListener('click', () => copyShareLink('collaborator'));
        } else {
            console.error('Element not found: copyCollabLink');
        }
        
        const qrViewerCode = document.getElementById('qrViewerCode');
        if (qrViewerCode) {
            qrViewerCode.addEventListener('click', () => generateQRCode('viewer'));
        } else {
            console.error('Element not found: qrViewerCode');
        }
        
        const qrCollabCode = document.getElementById('qrCollabCode');
        if (qrCollabCode) {
            qrCollabCode.addEventListener('click', () => generateQRCode('collaborator'));
        } else {
            console.error('Element not found: qrCollabCode');
        }
        
        const emailViewerLink = document.getElementById('emailViewerLink');
        if (emailViewerLink) {
            emailViewerLink.addEventListener('click', () => emailShareLink('viewer'));
        } else {
            console.error('Element not found: emailViewerLink');
        }
        
        const emailCollabLink = document.getElementById('emailCollabLink');
        if (emailCollabLink) {
            emailCollabLink.addEventListener('click', () => emailShareLink('collaborator'));
        } else {
            console.error('Element not found: emailCollabLink');
        }
        
        console.log('Share buttons setup completed');
    } catch (error) {
        console.error('Error setting up share buttons:', error);
    }
}

// Info Modal functions
function showInfoModal(item) {
    // Populate the info modal with item details
    document.getElementById('infoItemImage').src = item.imageUrl || 'images/no-image.svg';
    document.getElementById('infoItemImage').alt = item.name;
    document.getElementById('infoItemName').textContent = item.name;
    document.getElementById('infoItemDescription').textContent = item.description || 'No description';
    document.getElementById('infoItemPrice').textContent = item.price ? `$${item.price}` : 'No price';
    document.getElementById('infoItemNotes').textContent = item.notes || 'No notes';
    
    // Set up the link button if a URL exists
    const linkBtn = document.getElementById('infoItemLink');
    if (item.url) {
        linkBtn.href = item.url;
        linkBtn.classList.remove('hidden');
    } else {
        linkBtn.classList.add('hidden');
    }
    
    // Show the modal
    showModal('infoModal');
}

// Edit Modal functions
function showEditModal() {
    if (!currentList) return;
    
    // Populate the edit modal with list details
    document.getElementById('editListName').value = currentList.name;
    document.getElementById('editListDescription').value = currentList.description || '';
    document.getElementById('editListEventDate').value = currentList.eventDate || '';
    document.getElementById('editListPublic').checked = currentList.isPublic || false;

    
    // Populate collaborators and viewers lists
    populateUsersList('collaboratorsList', currentList.collaborators || {});
    populateUsersList('viewersList', currentList.viewers || {});
    
    // Show the modal
    showModal('editModal');
}

function populateUsersList(listId, users) {
    const listElement = document.getElementById(listId);
    listElement.innerHTML = '';
    
    if (!Array.isArray(users)) {
        users = Object.values(users || {});
    }
    
    users.forEach(email => {
        const listItem = document.createElement('li');
        listItem.className = 'user-item';
        
        const userEmail = document.createElement('span');
        userEmail.textContent = email;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-button';
        removeBtn.innerHTML = '<i class="material-icons">close</i>';
        removeBtn.addEventListener('click', () => removeUser(email, listId === 'collaboratorsList' ? 'collaborators' : 'viewers'));
        
        listItem.appendChild(userEmail);
        listItem.appendChild(removeBtn);
        listElement.appendChild(listItem);
    });
}

function removeUser(emailToRemove, role) {
    if (!currentList || !currentListId) return;
    
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    const updateData = {};
    updateData[role] = firebase.firestore.FieldValue.arrayRemove(emailToRemove);
    
    listRef.update(updateData)
        .then(() => {
            showToast(`User removed from ${role}`, 'success');
            // Refresh the list in the modal
            return firebaseDb.collection('lists').doc(currentListId).get();
        })
        .then(doc => {
            if (doc && doc.exists) {
                currentList = { id: doc.id, ...doc.data() };
                populateUsersList('collaboratorsList', currentList.collaborators || []);
                populateUsersList('viewersList', currentList.viewers || []);
            }
        })
        .catch(error => {
            console.error('Error removing user:', error);
            showToast(`Error removing user: ${error.message}`, 'error');
        });
}

function addCollaborator() {
    addUserToList('collaborator');
}

function addViewer() {
    addUserToList('viewer');
}

function addUserToList(role) {
    const inputId = role === 'collaborator' ? 'newCollaboratorEmail' : 'newViewerEmail';
    const email = document.getElementById(inputId).value.trim();
    
    if (!email || !currentList || !currentListId) {
        showToast('Please enter a valid email', 'error');
        return;
    }
    
    // Find user by email
    firebaseDb.collection('users').where('email', '==', email).get()
        .then(snapshot => {
            if (snapshot.empty) {
                showToast('User not found', 'error');
                return;
            }
            
            const user = snapshot.docs[0];
            const userId = user.id;
            const userData = user.data();
            
            // Don't add if it's the current user
            if (userData.email === auth.currentUser.email) {
                showToast('You cannot add yourself', 'error');
                return;
            }
            
            // Update the list document
            const listRef = firebaseDb.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[rolePath] = firebase.firestore.FieldValue.arrayUnion(userData.email);
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return firebaseDb.collection('lists').doc(currentListId).get();
        })
        .then(doc => {
            if (doc && doc.exists) {
                currentList = { id: doc.id, ...doc.data() };
                // Refresh the lists in the modal
                populateUsersList('collaboratorsList', currentList.collaborators || []);
                populateUsersList('viewersList', currentList.viewers || []);
            }
        })
        .catch(error => {
            console.error('Error adding user:', error);
            showToast(`Error adding user: ${error.message}`, 'error');
        });
}

function saveListEdit() {

    if (!currentList || !currentListId) return;
    
    const name = document.getElementById('editListName').value.trim();
    if (!name) {
        showToast('List name is required', 'error');
        return;
    }
    
    const description = document.getElementById('editListDescription').value.trim();
    const eventDate = document.getElementById('editListEventDate').value;
    const isPublic = document.getElementById('editListPublic').checked;
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    listRef.update({
        name,
        description,
        eventDate,
        isPublic,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showToast('List updated successfully', 'success');
        hideModal('editModal');
        
        // Update the current list object and refresh the UI
        currentList.name = name;
        currentList.description = description;
        currentList.eventDate = eventDate;
        currentList.isPublic = isPublic;

        
        // Update the list header
        document.getElementById('listTitle').textContent = name;
        // Update the list in the UI
        loadList(currentListId);
        document.getElementById('listEventDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    try {
        if (!currentListId) {
            console.error('Cannot generate share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        copyToClipboard(url);
        console.log(`Share link generated for type: ${type}`);
    } catch (error) {
        console.error('Error generating share link:', error);
        showToast('Error generating share link', 'error');
    }
}

function copyToClipboard(text) {
    try {
        if (!text) {
            console.error('No text provided to copy to clipboard');
            showToast('Nothing to copy', 'error');
            return;
        }
        
        console.log('Attempting to copy text to clipboard');
        navigator.clipboard.writeText(text)
            .then(() => {
                console.log('Text successfully copied to clipboard');
                showToast('Copied to clipboard!', 'success');
            })
            .catch(err => {
                console.error('Failed to copy text to clipboard:', err);
                showToast('Failed to copy text', 'error');
                
                // Fallback for browsers that don't support clipboard API
                fallbackCopyToClipboard(text);
            });
    } catch (error) {
        console.error('Error in copyToClipboard function:', error);
        showToast('Failed to copy text', 'error');
        
        // Try fallback method
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    try {
        console.log('Using fallback clipboard copy method');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';  // Avoid scrolling to bottom
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            console.log('Fallback clipboard copy succeeded');
            showToast('Copied to clipboard!', 'success');
        } else {
            console.error('Fallback clipboard copy failed');
            showToast('Failed to copy text', 'error');
        }
    } catch (error) {
        console.error('Error in fallback clipboard copy:', error);
        showToast('Failed to copy text', 'error');
    }
}

function generateShareUrl(type) {
    try {
        if (!currentListId) {
            console.error('No list ID available for generating share URL');
            showToast('Unable to generate share link', 'error');
            return '';
        }
        
        if (!type) {
            console.warn('No share type specified, defaulting to viewer');
            type = 'viewer';
        }
        
        // Validate type
        if (type !== 'viewer' && type !== 'collaborator') {
            console.warn(`Invalid share type: ${type}, defaulting to 'viewer'`);
            type = 'viewer';
        }
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?list=${encodeURIComponent(currentListId)}&role=${encodeURIComponent(type)}`;
        
        console.log(`Generated share URL for ${type} role`);
        return shareUrl;
    } catch (error) {
        console.error('Error generating share URL:', error);
        showToast('Unable to generate share link', 'error');
        return ''; // Return empty string instead of re-throwing
    }
}

function generateQRCode(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate QR code: No list is currently loaded');
            showToast('Cannot generate QR code: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL for QR code');
            showToast('Error generating QR code', 'error');
            return;
        }
        
        const canvas = document.getElementById('qrCanvas');
        const container = document.getElementById('qrCodeContainer');
        
        // Check if QRCode library is available
        console.log('typeof QRCode:', typeof QRCode);
        if (typeof QRCode !== 'undefined') {
            try {
                 new QRCode(canvas, {
                     text: url,
                     width: 200,
                     height: 200,
                     colorDark : "#000000",
                     colorLight : "#ffffff",
                     correctLevel : QRCode.CorrectLevel.H
                 });
                 container.classList.remove('hidden');
                 console.log(`QR code generated for type: ${type}`);
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showToast('Error generating QR code', 'error');
    }
}

function showFallbackQRCode(url, container, canvas) {
    try {
        console.log('Using fallback QR code display');
        
        // Validate inputs
        if (!url) {
            console.error('No URL provided for fallback QR code');
            return;
        }
        
        if (!container || !canvas) {
            console.error('Missing container or canvas element for fallback QR code');
            return;
        }
        
        // Hide the canvas
        canvas.style.display = 'none';
        
        // Create a fallback element if it doesn't exist
        let fallbackElement = document.getElementById('qrFallback');
        if (!fallbackElement) {
            fallbackElement = document.createElement('div');
            fallbackElement.id = 'qrFallback';
            fallbackElement.className = 'qr-fallback';
            container.appendChild(fallbackElement);
        }
        
        // Show the URL as text
        fallbackElement.innerHTML = `
            <p>QR Code generation is unavailable.</p>
            <p>Share this URL instead:</p>
            <div class="share-url">${escapeHtml(url)}</div>
            <button class="btn btn-primary" onclick="copyToClipboard('${url.replace(/'/g, "\\'")}')">Copy URL</button>
        `;
        
        // Show the container
        container.classList.remove('hidden');
        console.log('Fallback QR code display completed');
    } catch (error) {
        console.error('Error showing fallback QR code:', error);
        showToast('Error displaying share information', 'error');
    }
}

function emailShareLink(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate email share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
        const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
        
        console.log(`Email share link generated for type: ${type}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
        console.error('Error generating email share link:', error);
        showToast('Error generating email share link', 'error');
    }
}

// UI helper functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Hide QR code container when closing share modal
    if (modalId === 'shareModal') {
        document.getElementById('qrCodeContainer').classList.add('hidden');
    }
}

function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleBoughtItems() {
    showBoughtItems = document.getElementById('showBoughtToggle').checked;
    if (currentListId) {
        loadListItems(currentListId);
    }
}

function manageList() {
    showToast('List management modal would open here', 'info');
}

// Utility functions
function escapeHtml(text) {
    try {
        if (text === null || text === undefined) {
            console.warn('Attempted to escape null or undefined text');
            return '';
        }
        
        // Convert to string in case a non-string value is passed
        const textStr = String(text);
        const div = document.createElement('div');
        div.textContent = textStr;
        return div.innerHTML;
    } catch (error) {
        console.error('Error escaping HTML:', error);
        return '';
    }
}

function formatDate(dateObj) {
    try {
        if (!dateObj) {
            console.log('No date object provided to formatDate');
            return 'Not available';
        }
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                dateObj = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return 'Invalid date';
            }
        } else if (!(dateObj instanceof Date)) {
            // Try to convert to Date if it's not already a Date object
            try {
                dateObj = new Date(dateObj);
            } catch (error) {
                console.error('Error creating Date object:', error);
                return 'Invalid date';
            }
        }
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date object provided to formatDate');
            return 'Invalid date';
        }
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error formatting date';
    }
}

// Handle URL fragments for jumping to specific items
window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    if (hash.startsWith('#')) {
        const itemNumber = parseInt(hash.substring(1));
        if (itemNumber && !isNaN(itemNumber)) {
            jumpToItem(itemNumber);
        }
    }
});

function jumpToItem(itemNumber) {
    const items = document.querySelectorAll('.item-card');
    if (items[itemNumber - 1]) {
        items[itemNumber - 1].scrollIntoView({ behavior: 'smooth' });
        items[itemNumber - 1].style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => {
            items[itemNumber - 1].style.backgroundColor = '';
        }, 2000);
    }
}

// Handle native sharing on mobile devices
function handleNativeShare(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot share: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        const shareData = {
            title: `Wishlist: ${currentList.name}`,
            text: `Check out this wishlist!`,
            url: url
        };
        
        console.log(`Attempting native share for type: ${type}`);
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData).catch(err => {
                console.error('Error sharing:', err);
                showToast('Error sharing. Copying link instead.', 'warning');
                // Fallback to copy link
                copyShareLink(type);
            });
        } else {
            console.log('Native sharing not supported, falling back to copy link');
            // Fallback to copy link
            copyShareLink(type);
        }
    } catch (error) {
        console.error('Error in native share:', error);
        showToast('Error sharing. Copying link instead.', 'warning');
        try {
            copyShareLink(type);
        } catch (fallbackError) {
            console.error('Error in fallback share method:', fallbackError);
            showToast('Unable to share at this time', 'error');
        }
    }
}

// Detect user agent for platform-specific features
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

// Initialize URL handling on load
if (window.location.hash) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const hash = window.location.hash;
            if (hash.startsWith('#')) {
                const itemNumber = parseInt(hash.substring(1));
                if (itemNumber && !isNaN(itemNumber)) {
                    jumpToItem(itemNumber);
                }
            }
        }, 1000); // Wait for items to load
    });
}

/**
 * Toggles the sidebar open and close.
 */
function toggleSidebar() {
    if (sidebar.style.width === '250px') {
        sidebar.style.width = '0';
        mainContent.style.marginLeft = '0';
        appBar.classList.remove('shifted'); // Assuming appBar is defined globally or passed
    } else {
        sidebar.style.width = '250px';
        mainContent.style.marginLeft = '250px';
        appBar.classList.add('shifted');
        populateSidebarLists(); // Populate lists when opening
    }
}

/**
 * Populates the sidebar with the user's lists.
 */
function populateSidebarLists() {
    sidebarListContainer.innerHTML = ''; // Clear existing lists
    if (userLists.length === 0) {
        sidebarListContainer.innerHTML = '<li class="text-center mt-3">No lists yet.</li>';
        return;
    }
    userLists.forEach(list => {
        const listItem = document.createElement('li');
        listItem.dataset.listId = list.id;
        listItem.textContent = list.name;
        sidebarListContainer.appendChild(listItem);
    });
}

function showInfoModal(item) {
    // Populate the info modal with item details
    document.getElementById('infoItemImage').src = item.imageUrl || 'images/no-image.svg';
    document.getElementById('infoItemImage').alt = item.name;
    document.getElementById('infoItemName').textContent = item.name;
    document.getElementById('infoItemDescription').textContent = item.description || 'No description';
    document.getElementById('infoItemPrice').textContent = item.price ? `$${item.price}` : 'No price';
    document.getElementById('infoItemNotes').textContent = item.notes || 'No notes';
    
    // Set up the link button if a URL exists
    const linkBtn = document.getElementById('infoItemLink');
    if (item.url) {
        linkBtn.href = item.url;
        linkBtn.classList.remove('hidden');
    } else {
        linkBtn.classList.add('hidden');
    }
    
    // Show the modal
    showModal('infoModal');
}

// Edit Modal functions
function showEditModal() {
    if (!currentList) return;
    
    // Populate the edit modal with list details
    document.getElementById('editListName').value = currentList.name;
    document.getElementById('editListDescription').value = currentList.description || '';
    document.getElementById('editListEventDate').value = currentList.eventDate || '';
    document.getElementById('editListPublic').checked = currentList.isPublic || false;
    document.getElementById('editListOrdered').checked = currentList.ordered !== false;
    
    // Populate collaborators and viewers lists
    populateUsersList('collaboratorsList', currentList.collaborators || {});
    populateUsersList('viewersList', currentList.viewers || {});
    
    // Show the modal
    showModal('editModal');
}

function populateUsersList(listId, users) {
    const listElement = document.getElementById(listId);
    listElement.innerHTML = '';
    
    Object.entries(users).forEach(([uid, email]) => {
        const listItem = document.createElement('li');
        listItem.className = 'user-item';
        
        const userEmail = document.createElement('span');
        userEmail.textContent = email;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-button';
        removeBtn.innerHTML = '<i class="material-icons">close</i>';
        removeBtn.addEventListener('click', () => removeUser(uid, listId === 'collaboratorsList' ? 'collaborators' : 'viewers'));
        
        listItem.appendChild(userEmail);
        listItem.appendChild(removeBtn);
        listElement.appendChild(listItem);
    });
}

function removeUser(uid, role) {
    if (!currentList || !currentListId) return;
    
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    const updateData = {};
    updateData[`${role}.${uid}`] = firebase.firestore.FieldValue.delete();
    
    listRef.update(updateData)
        .then(() => {
            showToast(`User removed from ${role}`, 'success');
            // Refresh the list in the modal
            if (role === 'collaborators') {
                populateUsersList('collaboratorsList', currentList.collaborators || {});
            } else {
                populateUsersList('viewersList', currentList.viewers || {});
            }
        })
        .catch(error => {
            console.error('Error removing user:', error);
            showToast(`Error removing user: ${error.message}`, 'error');
        });
}

function addCollaborator() {
    addUserToList('collaborator');
}

function addViewer() {
    addUserToList('viewer');
}

function addUserToList(role) {
    const inputId = role === 'collaborator' ? 'newCollaboratorEmail' : 'newViewerEmail';
    const email = document.getElementById(inputId).value.trim();
    
    if (!email || !currentList || !currentListId) {
        showToast('Please enter a valid email', 'error');
        return;
    }
    
    // Find user by email
    firebaseDb.collection('users').where('email', '==', email).get()
        .then(snapshot => {
            if (snapshot.empty) {
                showToast('User not found', 'error');
                return;
            }
            
            const user = snapshot.docs[0];
            const userId = user.id;
            const userData = user.data();
            
            // Don't add if it's the current user
            if (userId === auth.currentUser.uid) {
                showToast('You cannot add yourself', 'error');
                return;
            }
            
            // Update the list document
            const listRef = firebaseDb.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[`${rolePath}.${userId}`] = userData.email;
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return firebaseDb.collection('lists').doc(currentListId).get();
        })
        .then(doc => {
            if (doc && doc.exists) {
                currentList = doc.data();
                // Refresh the lists in the modal
                populateUsersList('collaboratorsList', currentList.collaborators || {});
                populateUsersList('viewersList', currentList.viewers || {});
            }
        })
        .catch(error => {
            console.error('Error adding user:', error);
            showToast(`Error adding user: ${error.message}`, 'error');
        });
}

function saveListEdit() {
    if (!currentList || !currentListId) return;
    
    const name = document.getElementById('editListName').value.trim();
    if (!name) {
        showToast('List name is required', 'error');
        return;
    }
    
    const description = document.getElementById('editListDescription').value.trim();
    const eventDate = document.getElementById('editListEventDate').value;
    const isPublic = document.getElementById('editListPublic').checked;
    const ordered = document.getElementById('editListOrdered').checked;
    
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    listRef.update({
        name,
        description,
        eventDate,
        isPublic,
        ordered,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showToast('List updated successfully', 'success');
        hideModal('editModal');
        
        // Update the current list object and refresh the UI
        currentList.name = name;
        currentList.description = description;
        currentList.eventDate = eventDate;
        currentList.isPublic = isPublic;
        currentList.ordered = ordered;
        
        // Update the list header
        document.getElementById('listTitle').textContent = name;
        // Update the list in the UI
        loadList(currentListId);
        document.getElementById('listEventDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    try {
        if (!currentListId) {
            console.error('Cannot generate share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL');
            return;
        }
        
        copyToClipboard(url);
        console.log(`Share link generated for type: ${type}`);
    } catch (error) {
        console.error('Error generating share link:', error);
        showToast('Error generating share link', 'error');
    }
}

// Import list functionality
async function importList() {
    if (!currentUser || !currentList || currentUser.email !== currentList.owner) {
        showToast('Only the list owner can import items.', 'error');
        return;
    }

    // Show the AI settings modal first
    showModal('importAiSettingsModal');

    // Populate the API key field from localStorage if available
    document.getElementById('importGeminiApiKey').value = localStorage.getItem('geminiApiKey') || '';

    // Handle the "Continue to Import" button click
    document.getElementById('confirmImportAiSettingsBtn').onclick = async () => {
        hideModal('importAiSettingsModal');
        showToast('Importing list items...', 'info');

        const useAiSummarization = document.getElementById('useAiSummarization').checked;
        const importGeminiApiKey = document.getElementById('importGeminiApiKey').value.trim();
        const saveGeminiApiKeyLocal = document.getElementById('saveGeminiApiKeyLocal').checked;

        if (saveGeminiApiKeyLocal) {
            localStorage.setItem('geminiApiKey', importGeminiApiKey);
        } else {
            localStorage.removeItem('geminiApiKey');
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json'; // Only allow JSON files
        fileInput.style.display = 'none'; // Hide the input element
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                showToast('No file selected for import.', 'info');
                document.body.removeChild(fileInput); // Clean up
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const jsonInput = e.target.result;
                try {
                    const itemsToImport = JSON.parse(jsonInput);
                    if (!Array.isArray(itemsToImport)) {
                        throw new Error('Invalid JSON format. Expected an array of items.');
                    }

                    const listItemsCollectionRef = firebaseDb.collection('lists').doc(currentListId).collection('items');

                    // Get current position once, outside the loop
                    const currentSize = (await listItemsCollectionRef.get()).size;

                    for (let i = 0; i < itemsToImport.length; i++) {
                        const itemData = itemsToImport[i];

                        let generatedName = itemData.name || 'Untitled Item';
                        let description = itemData.description || '';
                        let notes = itemData.notes || '';

                        if (useAiSummarization && importGeminiApiKey) {
                            const aiDetails = await summarizeItemName(itemData.name || 'Untitled Item', importGeminiApiKey);
                            generatedName = aiDetails.generatedName || generatedName;
                            description = aiDetails.description || description;
                            notes = aiDetails.notes || notes;
                        }

                        const newItem = {
                            name: generatedName,
                            url: itemData.link || '',
                            description: description,
                            imageUrl: itemData.imageUrl || '',
                            notes: notes,
                            price: itemData.price || null,
                            position: currentSize + i + 1, // More efficient position calculation
                            bought: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };

                        await listItemsCollectionRef.add(newItem);
                        loadListItems(currentListId); // Refresh the UI after each item is imported
                    }

                    showToast('Items imported successfully!', 'success');

                } catch (error) {
                    console.error('Error importing list:', error);
                    showToast(`Error importing list: ${error.message}`, 'error');
                } finally {
                    // Clean up the input element
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                    }
                }
            };

            reader.onerror = function() {
                showToast('Error reading file', 'error');
                if (document.body.contains(fileInput)) {
                    document.body.removeChild(fileInput);
                }
            };

            reader.readAsText(file);
        });

        fileInput.click(); // Programmatically click the hidden input to open the file picker
    };

    // Add event listener for the cancel button
    document.getElementById('cancelImportAiSettingsBtn').onclick = () => {
        hideModal('importAiSettingsModal');
    };
}
async function deleteItem(itemId, itemName) {
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;

    if (!currentUser || !currentList || !canEdit) {
        showToast('Only the list owner or a collaborator can delete items.', 'error');
        return;
    }

    if (confirm(`Are you sure you want to delete '${itemName}'? This action cannot be undone.`)) {
        try {
            await firebaseDb.collection('lists').doc(currentListId).collection('items').doc(itemId).delete();
            showToast(`'${itemName}' deleted successfully!`, 'success');
            loadListItems(currentListId); // Refresh the UI
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast(`Error deleting item: ${error.message}`, 'error');
        }
    }
}

// copyToClipboard function is now defined globally

function generateShareUrl(type) {
    try {
        if (!currentListId) {
            console.error('No list ID available for generating share URL');
            showToast('Unable to generate share link', 'error');
            return '';
        }
        
        if (!type) {
            console.warn('No share type specified, defaulting to viewer');
            type = 'viewer';
        }
        
        // Validate type
        if (type !== 'viewer' && type !== 'collaborator') {
            console.warn(`Invalid share type: ${type}, defaulting to 'viewer'`);
            type = 'viewer';
        }
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?list=${encodeURIComponent(currentListId)}&role=${encodeURIComponent(type)}`;
        
        console.log(`Generated share URL for ${type} role`);
        return shareUrl;
    } catch (error) {
        console.error('Error generating share URL:', error);
        showToast('Unable to generate share link', 'error');
        return '';
    }
}

function generateQRCode(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate QR code: No list is currently loaded');
            showToast('Cannot generate QR code: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL for QR code');
            showToast('Error generating QR code', 'error');
            return;
        }
        
        const canvas = document.getElementById('qrCanvas');
        const container = document.getElementById('qrCodeContainer');
        
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            try {
                 new QRCode(canvas, {
                     text: url,
                     width: 200,
                     height: 200,
                     colorDark : "#000000",
                     colorLight : "#ffffff",
                     correctLevel : QRCode.CorrectLevel.H
                 });
                 container.classList.remove('hidden');
                 console.log(`QR code generated for type: ${type}`);
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showToast('Error generating QR code', 'error');
    }
}

function showFallbackQRCode(url, container, canvas) {
    try {
        console.log('Using fallback QR code display');
        
        // Validate inputs
        if (!url) {
            console.error('No URL provided for fallback QR code');
            return;
        }
        
        if (!container || !canvas) {
            console.error('Missing container or canvas element for fallback QR code');
            return;
        }
        
        // Hide the canvas
        canvas.style.display = 'none';
        
        // Create a fallback element if it doesn't exist
        let fallbackElement = document.getElementById('qrFallback');
        if (!fallbackElement) {
            fallbackElement = document.createElement('div');
            fallbackElement.id = 'qrFallback';
            fallbackElement.className = 'qr-fallback';
            container.appendChild(fallbackElement);
        }
        
        // Show the URL as text
        fallbackElement.innerHTML = `
            <p>QR Code generation is unavailable.</p>
            <p>Share this URL instead:</p>
            <div class="share-url">${escapeHtml(url)}</div>
            <button class="btn btn-primary" onclick="copyToClipboard('${url.replace(/'/g, "\\'")}')">Copy URL</button>
        `;
        
        // Show the container
        container.classList.remove('hidden');
        console.log('Fallback QR code display completed');
    } catch (error) {
        console.error('Error showing fallback QR code:', error);
        showToast('Error displaying share information', 'error');
    }
}

function emailShareLink(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate email share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL');
            showToast('Error generating share link', 'error');
            return;
        }
        
        const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
        const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
        
        console.log(`Email share link generated for type: ${type}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
        console.error('Error generating email share link:', error);
        showToast('Error generating email share link', 'error');
    }
}

// UI helper functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Hide QR code container when closing share modal
    if (modalId === 'shareModal') {
        document.getElementById('qrCodeContainer').classList.add('hidden');
    }
}

function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleBoughtItems() {
    showBoughtItems = document.getElementById('showBoughtToggle').checked;
    if (currentListId) {
        loadListItems(currentListId);
    }
}

function manageList() {
    showToast('List management modal would open here', 'info');
}

// Utility functions
function escapeHtml(text) {
    try {
        if (text === null || text === undefined) {
            console.warn('Attempted to escape null or undefined text');
            return '';
        }
        
        // Convert to string in case a non-string value is passed
        const textStr = String(text);
        const div = document.createElement('div');
        div.textContent = textStr;
        return div.innerHTML;
    } catch (error) {
        console.error('Error escaping HTML:', error);
        return '';
    }
}

function formatDate(dateObj) {
    try {
        if (!dateObj) {
            console.log('No date object provided to formatDate');
            return 'Not available';
        }
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                dateObj = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return 'Invalid date';
            }
        } else if (!(dateObj instanceof Date)) {
            // Try to convert to Date if it's not already a Date object
            try {
                dateObj = new Date(dateObj);
            } catch (error) {
                console.error('Error creating Date object:', error);
                return 'Invalid date';
            }
        }
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date object provided to formatDate');
            return 'Invalid date';
        }
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error formatting date';
    }
}

// Handle URL fragments for jumping to specific items
window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    if (hash.startsWith('#')) {
        const itemNumber = parseInt(hash.substring(1));
        if (itemNumber && !isNaN(itemNumber)) {
            jumpToItem(itemNumber);
        }
    }
});

function jumpToItem(itemNumber) {
    const items = document.querySelectorAll('.item-card');
    if (items[itemNumber - 1]) {
        items[itemNumber - 1].scrollIntoView({ behavior: 'smooth' });
        items[itemNumber - 1].style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => {
            items[itemNumber - 1].style.backgroundColor = '';
        }, 2000);
    }
}

// Handle native sharing on mobile devices
function handleNativeShare(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot share: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        const shareData = {
            title: `Wishlist: ${currentList.name}`,
            text: `Check out this wishlist!`,
            url: url
        };
        
        console.log(`Attempting native share for type: ${type}`);
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData).catch(err => {
                console.error('Error sharing:', err);
                showToast('Error sharing. Copying link instead.', 'warning');
                // Fallback to copy link
                copyShareLink(type);
            });
        } else {
            console.log('Native sharing not supported, falling back to copy link');
            // Fallback to copy link
            copyShareLink(type);
        }
    } catch (error) {
        console.error('Error in native share:', error);
        showToast('Error sharing. Copying link instead.', 'warning');
        try {
            copyShareLink(type);
        } catch (fallbackError) {
            console.error('Error in fallback share method:', fallbackError);
            showToast('Unable to share at this time', 'error');
        }
    }
}

// Detect user agent for platform-specific features
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

// Initialize URL handling on load
if (window.location.hash) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const hash = window.location.hash;
            if (hash.startsWith('#')) {
                const itemNumber = parseInt(hash.substring(1));
                if (itemNumber && !isNaN(itemNumber)) {
                    jumpToItem(itemNumber);
                }
            }
        }, 1000); // Wait for items to load
    });
}

/**
 * Toggles the sidebar open and close.
 */
function toggleSidebar() {
    if (sidebar.style.width === '250px') {
        sidebar.style.width = '0';
        mainContent.style.marginLeft = '0';
        appBar.classList.remove('shifted'); // Assuming appBar is defined globally or passed
    } else {
        sidebar.style.width = '250px';
        mainContent.style.marginLeft = '250px';
        appBar.classList.add('shifted');
        populateSidebarLists(); // Populate lists when opening
    }
}

/**
 * Populates the sidebar with the user's lists.
 */
function populateSidebarLists() {
    sidebarListContainer.innerHTML = ''; // Clear existing lists
    if (userLists.length === 0) {
        sidebarListContainer.innerHTML = '<li class="text-center mt-3">No lists yet.</li>';
        return;
    }
    userLists.forEach(list => {
        const listItem = document.createElement('li');
        listItem.dataset.listId = list.id;
        listItem.textContent = list.name;
        sidebarListContainer.appendChild(listItem);
    });
}

function showInfoModal(item) {
    // Populate the info modal with item details
    document.getElementById('infoItemImage').src = item.imageUrl || 'images/no-image.svg';
    document.getElementById('infoItemImage').alt = item.name;
    document.getElementById('infoItemName').textContent = item.name;
    document.getElementById('infoItemDescription').textContent = item.description || 'No description';
    document.getElementById('infoItemPrice').textContent = item.price ? `$${item.price}` : 'No price';
    document.getElementById('infoItemNotes').textContent = item.notes || 'No notes';
    
    // Set up the link button if a URL exists
    const linkBtn = document.getElementById('infoItemLink');
    if (item.url) {
        linkBtn.href = item.url;
        linkBtn.classList.remove('hidden');
    } else {
        linkBtn.classList.add('hidden');
    }
    
    // Show the modal
    showModal('infoModal');
}

// Edit Modal functions
function showEditModal() {
    if (!currentList) return;
    
    // Populate the edit modal with list details
    document.getElementById('editListName').value = currentList.name;
    document.getElementById('editListDescription').value = currentList.description || '';
    document.getElementById('editListEventDate').value = currentList.eventDate || '';
    document.getElementById('editListPublic').checked = currentList.isPublic || false;
    document.getElementById('editListOrdered').checked = currentList.ordered !== false;
    
    // Populate collaborators and viewers lists
    populateUsersList('collaboratorsList', currentList.collaborators || {});
    populateUsersList('viewersList', currentList.viewers || {});
    
    // Show the modal
    showModal('editModal');
}

function populateUsersList(listId, users) {
    const listElement = document.getElementById(listId);
    listElement.innerHTML = '';
    
    Object.entries(users).forEach(([uid, email]) => {
        const listItem = document.createElement('li');
        listItem.className = 'user-item';
        
        const userEmail = document.createElement('span');
        userEmail.textContent = email;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'icon-button';
        removeBtn.innerHTML = '<i class="material-icons">close</i>';
        removeBtn.addEventListener('click', () => removeUser(uid, listId === 'collaboratorsList' ? 'collaborators' : 'viewers'));
        
        listItem.appendChild(userEmail);
        listItem.appendChild(removeBtn);
        listElement.appendChild(listItem);
    });
}

function removeUser(uid, role) {
    if (!currentList || !currentListId) return;
    
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    const updateData = {};
    updateData[`${role}.${uid}`] = firebase.firestore.FieldValue.delete();
    
    listRef.update(updateData)
        .then(() => {
            showToast(`User removed from ${role}`, 'success');
            // Refresh the list in the modal
            if (role === 'collaborators') {
                populateUsersList('collaboratorsList', currentList.collaborators || {});
            } else {
                populateUsersList('viewersList', currentList.viewers || {});
            }
        })
        .catch(error => {
            console.error('Error removing user:', error);
            showToast(`Error removing user: ${error.message}`, 'error');
        });
}

function addCollaborator() {
    addUserToList('collaborator');
}

function addViewer() {
    addUserToList('viewer');
}

function addUserToList(role) {
    const inputId = role === 'collaborator' ? 'newCollaboratorEmail' : 'newViewerEmail';
    const email = document.getElementById(inputId).value.trim();
    
    if (!email || !currentList || !currentListId) {
        showToast('Please enter a valid email', 'error');
        return;
    }
    
    // Find user by email
    firebaseDb.collection('users').where('email', '==', email).get()
        .then(snapshot => {
            if (snapshot.empty) {
                showToast('User not found', 'error');
                return;
            }
            
            const user = snapshot.docs[0];
            const userId = user.id;
            const userData = user.data();
            
            // Don't add if it's the current user
            if (userId === auth.currentUser.uid) {
                showToast('You cannot add yourself', 'error');
                return;
            }
            
            // Update the list document
            const listRef = firebaseDb.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[`${rolePath}.${userId}`] = userData.email;
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return firebaseDb.collection('lists').doc(currentListId).get();
        })
        .then(doc => {
            if (doc && doc.exists) {
                currentList = doc.data();
                // Refresh the lists in the modal
                populateUsersList('collaboratorsList', currentList.collaborators || {});
                populateUsersList('viewersList', currentList.viewers || {});
            }
        })
        .catch(error => {
            console.error('Error adding user:', error);
            showToast(`Error adding user: ${error.message}`, 'error');
        });
}

function saveListEdit() {
    if (!currentList || !currentListId) return;
    
    const name = document.getElementById('editListName').value.trim();
    if (!name) {
        showToast('List name is required', 'error');
        return;
    }
    
    const description = document.getElementById('editListDescription').value.trim();
    const eventDate = document.getElementById('editListEventDate').value;
    const isPublic = document.getElementById('editListPublic').checked;
    const ordered = document.getElementById('editListOrdered').checked;
    
    const listRef = firebaseDb.collection('lists').doc(currentListId);
    listRef.update({
        name,
        description,
        eventDate,
        isPublic,
        ordered,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showToast('List updated successfully', 'success');
        hideModal('editModal');
        
        // Update the current list object and refresh the UI
        currentList.name = name;
        currentList.description = description;
        currentList.eventDate = eventDate;
        currentList.isPublic = isPublic;
        currentList.ordered = ordered;
        
        // Update the list header
        document.getElementById('listTitle').textContent = name;
        // Update the list in the UI
        loadList(currentListId);
        document.getElementById('listEventDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    try {
        if (!currentListId) {
            console.error('Cannot generate share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL');
            return;
        }
        
        copyToClipboard(url);
        console.log(`Share link generated for type: ${type}`);
    } catch (error) {
        console.error('Error generating share link:', error);
        showToast('Error generating share link', 'error');
    }
}

// copyToClipboard function is now defined globally

function generateShareUrl(type) {
    try {
        if (!currentListId) {
            console.error('No list ID available for generating share URL');
            showToast('Unable to generate share link', 'error');
            return '';
        }
        
        if (!type) {
            console.warn('No share type specified, defaulting to viewer');
            type = 'viewer';
        }
        
        // Validate type
        if (type !== 'viewer' && type !== 'collaborator') {
            console.warn(`Invalid share type: ${type}, defaulting to 'viewer'`);
            type = 'viewer';
        }
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?list=${encodeURIComponent(currentListId)}&role=${encodeURIComponent(type)}`;
        
        console.log(`Generated share URL for ${type} role`);
        return shareUrl;
    } catch (error) {
        console.error('Error generating share URL:', error);
        showToast('Unable to generate share link', 'error');
        return '';
    }
}

function generateQRCode(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate QR code: No list is currently loaded');
            showToast('Cannot generate QR code: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL for QR code');
            showToast('Error generating QR code', 'error');
            return;
        }
        
        const canvas = document.getElementById('qrCanvas');
        const container = document.getElementById('qrCodeContainer');
        
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            try {
                 new QRCode(canvas, {
                     text: url,
                     width: 200,
                     height: 200,
                     colorDark : "#000000",
                     colorLight : "#ffffff",
                     correctLevel : QRCode.CorrectLevel.H
                 });
                 container.classList.remove('hidden');
                 console.log(`QR code generated for type: ${type}`);
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showToast('Error generating QR code', 'error');
    }
}

function showFallbackQRCode(url, container, canvas) {
    try {
        console.log('Using fallback QR code display');
        
        // Validate inputs
        if (!url) {
            console.error('No URL provided for fallback QR code');
            return;
        }
        
        if (!container || !canvas) {
            console.error('Missing container or canvas element for fallback QR code');
            return;
        }
        
        // Hide the canvas
        canvas.style.display = 'none';
        
        // Create a fallback element if it doesn't exist
        let fallbackElement = document.getElementById('qrFallback');
        if (!fallbackElement) {
            fallbackElement = document.createElement('div');
            fallbackElement.id = 'qrFallback';
            fallbackElement.className = 'qr-fallback';
            container.appendChild(fallbackElement);
        }
        
        // Show the URL as text
        fallbackElement.innerHTML = `
            <p>QR Code generation is unavailable.</p>
            <p>Share this URL instead:</p>
            <div class="share-url">${escapeHtml(url)}</div>
            <button class="btn btn-primary" onclick="copyToClipboard('${url.replace(/'/g, "\\'")}')">Copy URL</button>
        `;
        
        // Show the container
        container.classList.remove('hidden');
        console.log('Fallback QR code display completed');
    } catch (error) {
        console.error('Error showing fallback QR code:', error);
        showToast('Error displaying share information', 'error');
    }
}

function emailShareLink(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot generate email share link: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        if (!url) {
            console.error('Failed to generate share URL');
            showToast('Error generating share link', 'error');
            return;
        }
        
        const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
        const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
        
        console.log(`Email share link generated for type: ${type}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
        console.error('Error generating email share link:', error);
        showToast('Error generating email share link', 'error');
    }
}

// UI helper functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Hide QR code container when closing share modal
    if (modalId === 'shareModal') {
        document.getElementById('qrCodeContainer').classList.add('hidden');
    }
}

function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleBoughtItems() {
    showBoughtItems = document.getElementById('showBoughtToggle').checked;
    if (currentListId) {
        loadListItems(currentListId);
    }
}

function manageList() {
    showToast('List management modal would open here', 'info');
}

// Utility functions
function escapeHtml(text) {
    try {
        if (text === null || text === undefined) {
            console.warn('Attempted to escape null or undefined text');
            return '';
        }
        
        // Convert to string in case a non-string value is passed
        const textStr = String(text);
        const div = document.createElement('div');
        div.textContent = textStr;
        return div.innerHTML;
    } catch (error) {
        console.error('Error escaping HTML:', error);
        return '';
    }
}

function formatDate(dateObj) {
    try {
        if (!dateObj) {
            console.log('No date object provided to formatDate');
            return 'Not available';
        }
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                dateObj = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return 'Invalid date';
            }
        } else if (!(dateObj instanceof Date)) {
            // Try to convert to Date if it's not already a Date object
            try {
                dateObj = new Date(dateObj);
            } catch (error) {
                console.error('Error creating Date object:', error);
                return 'Invalid date';
            }
        }
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date object provided to formatDate');
            return 'Invalid date';
        }
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error formatting date';
    }
}

// Handle URL fragments for jumping to specific items
window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    if (hash.startsWith('#')) {
        const itemNumber = parseInt(hash.substring(1));
        if (itemNumber && !isNaN(itemNumber)) {
            jumpToItem(itemNumber);
        }
    }
});

function jumpToItem(itemNumber) {
    const items = document.querySelectorAll('.item-card');
    if (items[itemNumber - 1]) {
        items[itemNumber - 1].scrollIntoView({ behavior: 'smooth' });
        items[itemNumber - 1].style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => {
            items[itemNumber - 1].style.backgroundColor = '';
        }, 2000);
    }
}

// Handle native sharing on mobile devices
function handleNativeShare(type) {
    try {
        if (!currentListId || !currentList) {
            console.error('Cannot share: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        const url = generateShareUrl(type);
        const shareData = {
            title: `Wishlist: ${currentList.name}`,
            text: `Check out this wishlist!`,
            url: url
        };
        
        console.log(`Attempting native share for type: ${type}`);
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData).catch(err => {
                console.error('Error sharing:', err);
                showToast('Error sharing. Copying link instead.', 'warning');
                // Fallback to copy link
                copyShareLink(type);
            });
        } else {
            console.log('Native sharing not supported, falling back to copy link');
            // Fallback to copy link
            copyShareLink(type);
        }
    } catch (error) {
        console.error('Error in native share:', error);
        showToast('Error sharing. Copying link instead.', 'warning');
        try {
            copyShareLink(type);
        } catch (fallbackError) {
            console.error('Error in fallback share method:', fallbackError);
            showToast('Unable to share at this time', 'error');
        }
    }
}

// Detect user agent for platform-specific features
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

// Initialize URL handling on load
if (window.location.hash) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const hash = window.location.hash;
            if (hash.startsWith('#')) {
                const itemNumber = parseInt(hash.substring(1));
                if (itemNumber && !isNaN(itemNumber)) {
                    jumpToItem(itemNumber);
                }
            }
        }, 1000); // Wait for items to load
    });
}
