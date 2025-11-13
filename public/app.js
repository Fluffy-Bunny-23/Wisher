// Global state
let currentUser = null;
let currentList = null;
let currentListId = null;
let currentListRole = null; // Global variable to store the role from the URL
let showBoughtItems = false;
let showAsViewer = false; // New global variable for viewer mode
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
let selectedItems = [];
let lastSelectedItemId = null;
let currentSortMethod = 'creators'; // Default sort method
let showExtensiveMovingButtons = false; // Toggle for extensive moving buttons

// DOM elements
const authScreen = document.getElementById('authScreen');
const listScreen = document.getElementById('listScreen');
const wishlistScreen = document.getElementById('wishlistScreen');
const loadingSpinner = document.getElementById('loadingSpinner');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarListContainer = document.getElementById('sidebarListContainer');
const createListSidebarBtn = document.getElementById('createListSidebarBtn');
const menuButton = document.getElementById('menuButton'); // Assuming you have a menu button in your app-bar
const mainContent = document.querySelector('.main-content'); // Or the main container that needs to shift
const appBar = document.getElementById('app-bar');

// Snapshot used for undoing the last large reorder operation
let lastReorderSnapshot = null;

// Firebase services (initialized in firebase-config.js)
// These are global variables, not redeclared here

function showSyncIndicator() {
    const el = document.getElementById('syncIndicator');
    if (el) el.classList.remove('hidden');
}

function hideSyncIndicator() {
    const el = document.getElementById('syncIndicator');
    if (el) el.classList.add('hidden');
}

function showUserStatus() {
    if (!currentUser || !currentList) {
        console.log('User status: No user or list loaded');
        return;
    }

    // Determine user role
    let userRole = 'viewer';
    let roleColor = '#FF9800'; // Orange for viewer
    
    if (currentUser.email === currentList.owner) {
        userRole = 'owner';
        roleColor = '#4CAF50'; // Green for owner
    } else {
        const collaboratorsField = currentList.collaborators || [];
        const isCollaborator = Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false;
        
        if (isCollaborator) {
            userRole = 'collaborator';
            roleColor = '#2196F3'; // Blue for collaborator
        }
    }

    // Create styled console message
    const style = [
        'background: ' + roleColor,
        'color: white',
        'padding: 8px 12px',
        'border-radius: 4px',
        'font-weight: bold',
        'font-size: 14px',
        'display: inline-block',
        'margin: 4px 0'
    ].join(';');

    console.log('%c User Status: ' + userRole.toUpperCase() + ' ', style);
    console.log('%c List: ' + currentList.name + ' | User: ' + currentUser.email, 'color: #666; font-style: italic;');
}

function showUndoToast(message, undoCallback) {
    // Create a toast with an Undo button
    const toast = document.createElement('div');
    toast.className = 'toast success';
    const msg = document.createElement('span');
    msg.textContent = message + ' ';
    const btn = document.createElement('button');
    btn.className = 'btn btn-text';
    btn.textContent = 'Undo';
    btn.addEventListener('click', async () => {
        try {
            await undoCallback();
            toast.remove();
        } catch (err) {
            console.error('Undo failed:', err);
            showToast('Undo failed: ' + (err.message || err), 'error');
        }
    });
    toast.appendChild(msg);
    toast.appendChild(btn);
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    // Auto-remove after 8s
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, 8000);
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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupAuthStateListener();
});



function updateTabTitle() {
    const hostname = window.location.hostname;
    let prefix = '';
    if (hostname === 'localhost') {
        prefix = '[LH] ';
    } else if (hostname === 'wisher-lists.web.app') {
        prefix = '[FB] ';
    } else if (hostname.endsWith('.app.github.dev')) {
        prefix = '[GC] ';
    }
    document.title = prefix + 'Wisher - Smart Wishlist Manager';
}

function initializeApp() {
    console.log('Initializing app');
    try {
        // Update tab title based on hostname
        updateTabTitle();

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
        const listRef = db.collection('lists').doc(listId);
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
        
        // Show bought items toggle functionality now handled by showAsViewerToggle

        // Show as viewer toggle
        const showAsViewerToggle = document.getElementById('showAsViewerToggle');
        if (showAsViewerToggle) {
            showAsViewerToggle.addEventListener('change', toggleViewerMode);
        } else {
            console.error('Element not found: showAsViewerToggle');
        }
        
        // Extensive moving buttons toggle
        const showExtensiveMovingToggle = document.getElementById('showExtensiveMovingToggle');
        if (showExtensiveMovingToggle) {
            showExtensiveMovingToggle.addEventListener('change', toggleExtensiveMovingButtons);
        } else {
            console.error('Element not found: showExtensiveMovingToggle');
        }
        
        // Sort controls
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', handleSortChange);
        } else {
            console.error('Element not found: sortSelect');
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
            menuButton.addEventListener('click', toggleSidebarNew);
        } else {
            console.error('Element not found: menuButton');
        }
        
        if (sidebarCloseBtn) {
            sidebarCloseBtn.addEventListener('click', toggleSidebarNew);
        } else {
            console.error('Element not found: sidebarCloseBtn');
        }
        
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', toggleSidebarNew);
        } else {
            console.error('Element not found: sidebarBackdrop');
        }
        
        if (createListSidebarBtn) {
            createListSidebarBtn.addEventListener('click', () => {
                toggleSidebarNew();
                createNewList();
            });
        } else {
            console.error('Element not found: createListSidebarBtn');
        }
        
if (sidebarCloseBtn) {
            sidebarCloseBtn.addEventListener('click', toggleSidebar);
        } else {
            console.error('Element not found: sidebarCloseBtn');
        }
        
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', toggleSidebar);
        } else {
            console.error('Element not found: sidebarBackdrop');
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
}

// Updated toggleSidebar function using classes
function toggleSidebarNew() {
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        // Close sidebar
        sidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('show');
        mainContent.style.marginLeft = '0';
        appBar.classList.remove('shifted');
    } else {
        // Open sidebar
        sidebar.classList.add('open');
        sidebarBackdrop.classList.add('show');
        const sidebarWidth = window.innerWidth <= 480 ? '320px' : '300px';
        mainContent.style.marginLeft = sidebarWidth;
        appBar.classList.add('shifted');
        populateSidebarLists(); // Populate lists when opening
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

    // Debug helper: log clicks on key management buttons so we can see if handlers are firing
    try {
        const managedButtonIds = new Set([
            'createListBtn','createListSidebarBtn','addItemBtn','addGroupBtn','manageListBtn','importListBtn',
            'addCollaboratorBtn','addViewerBtn','saveItemBtn','saveGroupBtn','saveEditBtn'
        ]);
        window.addEventListener('click', (e) => {
            try {
                const btn = e.target.closest && e.target.closest('button');
                if (btn && btn.id && managedButtonIds.has(btn.id)) {
                    console.log(`DEBUG: Button clicked -> id=${btn.id}, classes=${btn.className}`);
                }
            } catch (err) {
                // swallow
            }
        });
    } catch (err) {
        console.error('Error setting up debug click logger:', err);
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
        
        // Check if db is initialized
        if (!db) {
            console.error('Firestore database not initialized');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Querying Firestore for lists owned by:', currentUser.email);
        const listsQuery = db.collection('lists')
            .where('owner', '==', currentUser.email);
        
        const collaboratorQuery = db.collection('lists')
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
        
        const docRef = await db.collection('lists').add(listData);
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
        
        // Check if db is initialized
        if (!db) {
            console.error('Firestore database not initialized in loadList');
            clearTimeout(safetyTimeout);
            hideLoading();
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Loading list with ID:', listId);
        const listDoc = await db.collection('lists').doc(listId).get();
        
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
        
        // Reset sort method to default (creators order) when loading a new list
        currentSortMethod = 'creators';
        
        // Debug: Log the eventDate to see what format it's in
        console.log('loadList: currentList.eventDate =', currentList.eventDate);
        console.log('loadList: typeof currentList.eventDate =', typeof currentList.eventDate);
        if (currentList.eventDate && currentList.eventDate.toDate) {
            console.log('loadList: eventDate is a Firestore Timestamp');
        }

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
        
        // Show user status in console
        showUserStatus();
        
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
    
    // Set sort select to current sort method
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = currentSortMethod;
    } else {
        console.log('Sort select not found during displayList');
    }

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

    // Show/hide extensive moving toggle for owners/collaborators
    const extensiveMovingToggle = document.getElementById('extensiveMovingToggle');
    if (extensiveMovingToggle) {
        extensiveMovingToggle.style.display = canEdit ? 'flex' : 'none';
    }

    // Show/hide viewer mode toggle for owners/collaborators
    const viewerModeToggle = document.getElementById('viewerModeToggle');
    if (viewerModeToggle) {
        viewerModeToggle.style.display = canEdit ? 'flex' : 'none';
    }

    // Hide edit controls when in viewer mode
    const effectiveCanEdit = canEdit && !showAsViewer;
    document.getElementById('addItemBtn').style.display = effectiveCanEdit ? 'flex' : 'none';
    document.getElementById('manageListBtn').style.display = (isOwner && !showAsViewer) ? 'flex' : 'none';
    if (importListBtn) {
        importListBtn.style.display = (isOwner && !showAsViewer) ? 'block' : 'none';
    }
}

async function loadListItems(listId) {
    // Set a safety timeout to hide the loading spinner after 10 seconds
    const safetyTimeout = setTimeout(() => {
        console.log('Safety timeout triggered in loadListItems - hiding loading spinner');
        hideLoading();
        showToast('Loading items timed out. Please try again.', 'error');
    }, 10000);
    
    try {
        // Check if db is initialized
        if (!db) {
            console.error('Firestore database not initialized in loadListItems');
            clearTimeout(safetyTimeout);
            showToast('Database connection error. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Loading items and groups for list:', listId);
        
        // Fetch both items and groups in parallel
        const [itemsSnapshot, groupsSnapshot] = await Promise.all([
            db.collection('lists').doc(listId).collection('items').orderBy('position', 'asc').get(),
            db.collection('lists').doc(listId).collection('groups').get()
        ]);
        
        const items = [];
        const groups = {};
        
        itemsSnapshot.forEach(doc => {
            const itemData = doc.data();
            // Ensure comments array exists
            if (!itemData.comments) {
                itemData.comments = [];
            }
            items.push({ id: doc.id, ...itemData });
        });
        
        groupsSnapshot.forEach(doc => {
            groups[doc.id] = { id: doc.id, ...doc.data() };
        });
        
        console.log(`Loaded ${items.length} items and ${Object.keys(groups).length} groups for list ${listId}`);
        
        // Apply sorting to items
        const sortedItems = sortItems(items, groups);
        displayItems(sortedItems, groups);
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

    // Determine edit permissions for persistence
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const collaboratorsField = currentList ? currentList.collaborators || [] : [];
    const isCollaborator = currentUser && (
        Array.isArray(collaboratorsField)
            ? collaboratorsField.includes(currentUser.email)
            : typeof collaboratorsField === 'object' && collaboratorsField !== null
                ? Object.values(collaboratorsField).includes(currentUser.email)
                : false
    );
    const canEdit = isOwner || isCollaborator;
    
    // Auto-set viewer mode for actual viewers and hide toggle
    const viewerModeToggle = document.getElementById('viewerModeToggle');
    const showAsViewerToggle = document.getElementById('showAsViewerToggle');
    const viewerModeContainer = viewerModeToggle ? viewerModeToggle.parentElement : null;
    
    if (!canEdit && currentUser) {
        // This is a viewer - auto-enable viewer mode and hide toggle
        showAsViewer = true;
        showBoughtItems = true;
        if (showAsViewerToggle) {
            showAsViewerToggle.checked = true;
        }
        if (viewerModeContainer) {
            viewerModeContainer.style.display = 'none';
        }
    } else if (canEdit && viewerModeContainer) {
        // This is owner/collaborator - show the toggle
        viewerModeContainer.style.display = 'flex';
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
    const reliantItems = {}; // triggerItemId -> [reliant items]

    items.forEach(item => {
        // Check if item should be visible based on conditional visibility first
        if (item.conditionalVisibility && item.triggerItemId) {
            const triggerItem = items.find(it => it.id === item.triggerItemId);
            const isTriggerBought = !!(triggerItem && triggerItem.bought);
            
            // Debug logging
            console.log('Processing reliant item:', item.name, 'trigger:', triggerItem?.name, 'trigger bought:', isTriggerBought);
            
            // Check if user is owner or collaborator
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
            
            console.log('User permissions - canEdit:', canEdit, 'currentUser:', currentUser?.email);
            
            // For viewers: hide until trigger is bought
            if (!canEdit && !isTriggerBought) {
                console.log('Hiding reliant item for viewer - trigger not bought');
                return;
            }
            
            console.log('Showing reliant item');
            
            // Store trigger status for styling
            item._triggerBought = isTriggerBought;
            
            // Add to reliant items mapping instead of ungroupedItems
            if (!reliantItems[item.triggerItemId]) {
                reliantItems[item.triggerItemId] = [];
            }
            reliantItems[item.triggerItemId].push(item);
            return; // Don't add to ungroupedItems
        }
        
        // Apply bought toggle filter only to non-reliant items
        if (!showBoughtItems && item.bought) return; // respect bought toggle
        
        const gid = item.groupId || '';
        if (!gid) {
            ungroupedItems.push(item);
        } else {
            if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
            itemsByGroup[gid].push(item);
        }
    });
    
    // Sort items within each group
    Object.keys(itemsByGroup).forEach(gid => {
        itemsByGroup[gid] = sortItems(itemsByGroup[gid], groups);
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

    // Shared sequential display counter for both items and groups (display-only)
    // This ensures groups and items are numbered in the same sequence: 1=item, 2=group, 3=item, 4=group, etc.
    const groupDisplayIndex = {};
    let displayCounter = 1;

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
        
        // Assign the group a display number from the shared sequence (just like an item gets one)
        const displayNo = displayCounter++;
        groupDisplayIndex[groupId] = displayNo;
        groupContainer.dataset.groupDisplayNumber = displayNo;

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
        const effectiveCanEdit = canEdit && !showAsViewer;

    // Group header
    const header = document.createElement('div');
    header.className = 'group-header';
    const groupName = group.name || 'Untitled Group';
    const groupDescription = group.description || '';

    // Create collapse toggle button (defined before insertion/use)
    const collapseToggle = document.createElement('button');
    collapseToggle.className = 'icon-button group-collapse-toggle';
    collapseToggle.title = 'Toggle group items visibility';
    collapseToggle.innerHTML = `<span class="material-icons">expand_more</span>`;
        
            header.innerHTML = `
                <div class="group-header-left">
                    <h3 class="group-title"><span class="group-number">${groupContainer.dataset.groupDisplayNumber}.</span> ${escapeHtml(groupName)} ${group.imageUrl ? `<img src="${group.imageUrl}" alt="${escapeHtml(group.name || 'Group')}" class="group-image-inline" onerror="this.style.display='none'">` : ''}</h3>
                    ${groupDescription ? `<p class="group-description">${escapeHtml(groupDescription)}</p>` : ''}
                </div>
                <div class="group-actions">
                    ${effectiveCanEdit ? `
                        <button class="icon-button group-drag-handle" title="Drag to reorder">
                            <span class="material-icons">drag_indicator</span>
                        </button>
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
        
            // Insert collapse toggle at the start of the left area so it flows naturally
            const leftArea = header.querySelector('.group-header-left') || header;
            leftArea.insertAdjacentElement('afterbegin', collapseToggle);

        // Create items container that can be collapsed
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'group-items-container';
        itemsContainer.dataset.groupId = groupId;
        
        // Check if this group was previously collapsed and restore that state
        const collapsedGroups = JSON.parse(localStorage.getItem('collapsedGroups') || '{}');
        const isCollapsed = collapsedGroups[currentListId]?.[groupId] || false;
        if (isCollapsed) {
            itemsContainer.classList.add('collapsed');
            collapseToggle.innerHTML = `<span class="material-icons">expand_less</span>`;
            collapseToggle.title = 'Expand group items';
        }
        
        // Add collapse toggle event listener
        collapseToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            itemsContainer.classList.toggle('collapsed');
            const icon = collapseToggle.querySelector('.material-icons');
            
            // Persist collapse state to localStorage
            const collapsedGroups = JSON.parse(localStorage.getItem('collapsedGroups') || '{}');
            if (!collapsedGroups[currentListId]) collapsedGroups[currentListId] = {};
            
            if (itemsContainer.classList.contains('collapsed')) {
                icon.textContent = 'expand_less';
                collapseToggle.title = 'Expand group items';
                collapsedGroups[currentListId][groupId] = true;
            } else {
                icon.textContent = 'expand_more';
                collapseToggle.title = 'Collapse group items';
                collapsedGroups[currentListId][groupId] = false;
            }
            localStorage.setItem('collapsedGroups', JSON.stringify(collapsedGroups));
        });

        // Sort items within groups
        const sortedGroupItems = sortItems(groupItems, groups);
        
        // Group items use composite numbering (group#.item#, e.g., "2.1" if group is #2)
        sortedGroupItems.forEach((item, idx) => {
            const compositeLabel = `${groupDisplayIndex[groupId]}.${idx + 1}`;
            const itemCard = createItemCard(item, compositeLabel);
            itemsContainer.appendChild(itemCard);
        });

        groupContainer.appendChild(itemsContainer);
        container.appendChild(groupContainer);
        renderedGroups.add(groupId);
    }

    // Sort ungrouped items
    const sortedUngroupedItems = sortItems(ungroupedItems, groups);
    
    // Render ungrouped items first; attach any reliant items and groups triggered by each item directly after
    if (sortedUngroupedItems.length > 0) {
        sortedUngroupedItems.forEach((item) => {
            const label = String(displayCounter++);
            const itemCard = createItemCard(item, label);
            container.appendChild(itemCard);

            // Render reliant items that depend on this item
            const itemReliants = reliantItems[item.id] || [];
            const sortedReliants = sortItems(itemReliants, groups);
            sortedReliants.forEach(reliantItem => {
                const reliantLabel = String(displayCounter++);
                const reliantCard = createItemCard(reliantItem, reliantLabel);
                
                // Add indentation and styling for reliant items
                reliantCard.classList.add('reliant-item');
                if (reliantItem._triggerBought) {
                    reliantCard.classList.add('reliant-trigger-bought');
                } else {
                    reliantCard.classList.add('reliant-trigger-pending');
                }
                
                container.appendChild(reliantCard);
            });

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

    // After rendering, persist the visible ordering back to the database so stored positions match display order.
    // Only attempt to write if the current user can edit the list (owner or collaborator) AND we're in creators order mode.
    // Don't persist when just sorting for viewing - only when actually reordering items.
    try {
        if (canEdit && db && currentListId && currentSortMethod === 'creators') {
            // Persist DOM order including groups (handles empty groups now)
            persistDomOrder(container).catch(err => console.error('Error persisting order to DB:', err));
        }
    } catch (err) {
        console.error('Error during persistence step:', err);
    }
}

function handleSortChange() {
    const sortSelect = document.getElementById('sortSelect');
    currentSortMethod = sortSelect.value;
    
    // Reload and re-sort items
    loadListItems(currentListId);
}

function sortItems(items, groups = {}) {
    // Don't sort if using creator's order
    if (currentSortMethod === 'creators') {
        return items.sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    
    let sortedItems = [...items];
    
    switch (currentSortMethod) {
        case 'price-high':
            sortedItems.sort((a, b) => {
                const priceA = parseFloat(a.price) || 0;
                const priceB = parseFloat(b.price) || 0;
                return priceB - priceA; // High to low
            });
            break;
            
        case 'price-low':
            sortedItems.sort((a, b) => {
                const priceA = parseFloat(a.price) || 0;
                const priceB = parseFloat(b.price) || 0;
                return priceA - priceB; // Low to high
            });
            break;
            
        case 'alphabetical':
            sortedItems.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            break;
            
        default:
            // Default to creator's order
            sortedItems.sort((a, b) => (a.position || 0) - (b.position || 0));
            break;
    }
    
    return sortedItems;
}

// Persist an array of item IDs (in display order) to Firestore by updating their numeric positions.
// Handles large lists by chunking batch commits to avoid Firestore batch size limits.
async function persistVisibleOrderToDb(orderedItemIds) {
    if (!currentListId || !db) return;
    if (!Array.isArray(orderedItemIds) || orderedItemIds.length === 0) return;

    const itemsRef = db.collection('lists').doc(currentListId).collection('items');
    // Firestore limits batches to 500 operations. Use safe chunk size (e.g., 400).
    const CHUNK_SIZE = 400;
    for (let i = 0; i < orderedItemIds.length; i += CHUNK_SIZE) {
        const chunk = orderedItemIds.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        chunk.forEach((id, idx) => {
            const absolutePos = i + idx + 1; // 1-based positions across whole list
            batch.update(itemsRef.doc(id), {
                position: absolutePos,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
    }
}

// Persist ordering based on DOM structure, keeping group blocks and empty groups in mind.
// This writes back numeric positions for items and a `position` field for groups indicating their block order.
async function persistDomOrder(container) {
    if (!currentListId || !db) return;
    showSyncIndicator();
    try {
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        const groupsRef = db.collection('lists').doc(currentListId).collection('groups');

        const itemsSequence = [];
        const groupSequenceNumbers = {}; // gid -> sequenceNumber (0-based for items, both items and groups in order)
        let blockIndex = 1;
        let sequenceNum = 1;

        Array.from(container.children).forEach(child => {
            if (child.classList.contains('item-card')) {
                if (child.dataset && child.dataset.itemId) itemsSequence.push(child.dataset.itemId);
                sequenceNum++;
            } else if (child.classList.contains('group-container')) {
                const gid = child.dataset.groupId;
                if (gid) {
                    groupSequenceNumbers[gid] = sequenceNum;
                    blockIndex++;
                    sequenceNum++;
                }
                const itemsContainer = child.querySelector('.group-items-container');
                if (itemsContainer) {
                    Array.from(itemsContainer.querySelectorAll('.item-card')).forEach(ic => {
                        if (ic.dataset && ic.dataset.itemId) itemsSequence.push(ic.dataset.itemId);
                    });
                }
            }
        });

        // Prepare snapshot for undo by reading current positions
        const itemDocPromises = itemsSequence.map(id => itemsRef.doc(id).get());
        const groupDocPromises = Object.keys(groupSequenceNumbers).map(gid => groupsRef.doc(gid).get());

        const [itemDocs, groupDocs] = await Promise.all([
            Promise.all(itemDocPromises),
            Promise.all(groupDocPromises)
        ]);

        const prevItems = itemDocs.map(d => ({ id: d.id, position: d.exists ? d.data().position : null }));
        const groupIds = Object.keys(groupSequenceNumbers);
        const prevGroups = groupDocs.map(d => ({ id: d.id, position: d.exists ? d.data().position : null }));

        // Build writes: items get positions 1..N in sequence
        const itemUpdates = itemsSequence.map((id, idx) => ({ id, position: idx + 1 }));
        const groupUpdates = groupIds.map(gid => ({ 
            id: gid, 
            position: groupSequenceNumbers[gid],
            displayOrder: groupSequenceNumbers[gid]
        }));

        // Store snapshot for undo
        lastReorderSnapshot = { items: prevItems, groups: prevGroups };

        // Perform batched writes (items + groups), chunking to avoid batch limits
        const allWrites = [];
        const itemsRefPath = itemsRef; // for clarity
        const groupsRefPath = groupsRef;

        itemUpdates.forEach(u => allWrites.push({ ref: itemsRefPath.doc(u.id), data: { position: u.position, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }));
        groupUpdates.forEach(u => allWrites.push({ ref: groupsRefPath.doc(u.id), data: { position: u.position, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }));

        const CHUNK = 400;
        for (let i = 0; i < allWrites.length; i += CHUNK) {
            const chunk = allWrites.slice(i, i + CHUNK);
            const batch = db.batch();
            chunk.forEach(w => batch.update(w.ref, w.data));
            await batch.commit();
        }

        // Keep undo snapshot but do not show a popup; log to console instead
        console.log('Order synced. Undo snapshot stored on `lastReorderSnapshot`. Call undoLastReorder() to revert.');
    } catch (err) {
        console.error('persistDomOrder error:', err);
        throw err;
    } finally {
        hideSyncIndicator();
    }
}

async function undoLastReorder() {
    if (!lastReorderSnapshot) {
        showToast('Nothing to undo', 'warning');
        return;
    }
    showSyncIndicator();
    try {
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        const groupsRef = db.collection('lists').doc(currentListId).collection('groups');

        const itemWrites = lastReorderSnapshot.items || [];
        const groupWrites = lastReorderSnapshot.groups || [];

        const all = [];
        itemWrites.forEach(u => all.push({ ref: itemsRef.doc(u.id), data: { position: u.position, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }));
        groupWrites.forEach(u => all.push({ ref: groupsRef.doc(u.id), data: { position: u.position, updatedAt: firebase.firestore.FieldValue.serverTimestamp() } }));

        const CHUNK = 400;
        for (let i = 0; i < all.length; i += CHUNK) {
            const chunk = all.slice(i, i + CHUNK);
            const batch = db.batch();
            chunk.forEach(w => batch.update(w.ref, w.data));
            await batch.commit();
        }

        showToast('Reorder undone', 'success');
        await loadListItems(currentListId);
        lastReorderSnapshot = null;
    } catch (err) {
        console.error('undoLastReorder error:', err);
        showToast('Undo failed: ' + (err.message || err), 'error');
    } finally {
        hideSyncIndicator();
    }
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
    const effectiveCanEdit = canEdit && !showAsViewer;
    
    // Check if user is a viewer (not owner, not collaborator, but has access)
    const viewersField = currentList.viewers || [];
    const isExplicitViewer = currentUser && !isOwner && !isCollaborator && (
        Array.isArray(viewersField)
            ? viewersField.includes(currentUser.email)
            : typeof viewersField === 'object' && viewersField !== null
                ? Object.values(viewersField).includes(currentUser.email)
                : false
    );
    // Check if user is accessing as a viewer via share link
    const isViewerViaShare = currentListRole === 'viewer';
    // Any authenticated user can add comments
    const canAddComments = currentUser;
    
    // Show comments if showBoughtItems is on OR showAsViewer is on
    const shouldShowComments = showBoughtItems || showAsViewer;
    
    // Show gray line only if there are actual comments to display
    const hasComments = item.comments && Array.isArray(item.comments) && item.comments.length > 0;
    const shouldShowGrayLine = shouldShowComments && hasComments;

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
        // Don't trigger if clicking on a button, link, or comments section
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.comments-section')) {
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
                ${effectiveCanEdit ? `
                    <button class="icon-button" onclick="editItem('${item.id}')" title="Edit">
                        <span class="material-icons">edit</span>
                    </button>
                ` : ''}
                ${shouldShowComments && canAddComments ? `
                    <button class="icon-button" onclick="toggleCommentForm('${item.id}')" title="Add Comment">
                        <span class="material-icons">comment</span>
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
                ${effectiveCanEdit ? `
                    <button class="icon-button" onclick="summarizeItem('${item.id}')" title="AI Summarize">
                        <span class="material-icons">psychology</span>
                    </button>
                ` : ''}
                ${!item.bought ? `
                    <button class="icon-button" onclick="markAsBought('${item.id}')" title="Mark as bought">
                        <span class="material-icons">shopping_cart</span>
                    </button>
                ` : ''}
                ${item.bought && currentUser && item.buyerEmail === currentUser.email ? `
                    <button class="icon-button" onclick="unmarkAsBought('${item.id}')" title="Unmark as bought (erase purchase data)">
                        <span class="material-icons">restore</span>
                    </button>
                ` : ''}
                ${effectiveCanEdit ? `
                    <button class="icon-button drag-handle" title="Drag to reorder">
                        <span class="material-icons">drag_indicator</span>
                    </button>
                    ${showExtensiveMovingButtons ? `
                        <button class="icon-button move-button" onclick="moveItemToTop('${item.id}')" title="Move to top">
                            <span class="material-icons">keyboard_double_arrow_up</span>
                        </button>
                        <button class="icon-button move-button" onclick="moveItemToMiddle('${item.id}')" title="Move to middle">
                            <span class="material-icons">drag_handle</span>
                        </button>
                        <button class="icon-button move-button" onclick="moveItemToBottom('${item.id}')" title="Move to bottom">
                            <span class="material-icons">keyboard_double_arrow_down</span>
                        </button>
                    ` : ''}
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
                ${effectiveCanEdit ? `
                    <button class="btn btn-secondary" onclick="markAsNotBought('${item.id}')">
                        <span class="material-icons">remove_shopping_cart</span>
                        Mark as Not Bought
                    </button>
                ` : ''}
            </div>
        ` : ''}
        ${shouldShowComments ? `
            <div class="comments-section ${hasComments ? '' : 'no-comments'}" id="comments-section-${item.id}" style="${hasComments ? '' : 'border-top: none;'}">
                ${item.comments && Array.isArray(item.comments) && item.comments.length > 0 ? `
                    <h4>Comments</h4>
                    <div id="comments-list-${item.id}" class="comments-list">
                        ${item.comments
                            .filter(comment => comment && comment.text) // Filter out invalid comments
                            .sort((a, b) => {
                                // Sort by timestamp (newest first)
                                const timeA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
                                const timeB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
                                return timeB - timeA;
                            })
                            .map((comment, index) => {
                                const isOwnComment = currentUser && comment.authorEmail === currentUser.email;
                                const commentId = comment.id || `comment-${index}`;
                                return `
                                <div class="comment" data-comment-id="${commentId}" data-comment-index="${index}" data-author-email="${comment.authorEmail || ''}">
                                    <div class="comment-header">
                                        <div class="comment-author">
                                            ${escapeHtml(comment.authorName || 'Anonymous')}
                                            ${comment.authorName && comment.authorEmail && comment.authorName !== comment.authorEmail ? 
                                                `<span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 4px;">(${escapeHtml(comment.authorEmail)})</span>` : 
                                                comment.authorEmail ? 
                                                    `<span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 4px;">(${escapeHtml(comment.authorEmail)})</span>` : 
                                                    ''
                                            }
                                        </div>
                                        ${isOwnComment ? `
                                            <div class="comment-actions">
                                                <button class="icon-button comment-edit-btn" onclick="editComment('${item.id}', '${commentId}', ${index})" title="Edit comment">
                                                    <span class="material-icons">edit</span>
                                                </button>
                                                <button class="icon-button comment-delete-btn" onclick="deleteComment('${item.id}', '${commentId}', ${index})" title="Delete comment">
                                                    <span class="material-icons">delete</span>
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                                    ${comment.timestamp ? `
                                        <div class="comment-date" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                                            ${formatDate(comment.timestamp)}
                                        </div>
                                    ` : ''}
                                </div>
                            `}).join('')}
                    </div>
                ` : ''}
                ${canAddComments ? `
                    <div class="add-comment-form" id="add-comment-form-${item.id}" style="margin-top: 12px; display: none;">
                        <textarea id="comment-input-${item.id}" class="comment-input" rows="2" placeholder="Add a comment..."></textarea>
                        <button class="btn btn-primary" onclick="addComment('${item.id}')" style="margin-top: 8px;">
                            <span class="material-icons">comment</span>
                            Add Comment
                        </button>
                    </div>
                ` : ''}
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
    try {
        const groupRef = db.collection('lists').doc(currentListId).collection('groups').doc(groupId);
        groupRef.get().then(doc => {
            if (!doc.exists) {
                showToast('Group not found', 'error');
                return;
            }
            const group = doc.data();
            const form = document.getElementById('groupForm');
            if (!form) {
                showToast('Group form not found', 'error');
                return;
            }

            // Populate fields
            document.getElementById('groupModalTitle').textContent = 'Edit Group';
            document.getElementById('groupName').value = group.name || '';
            document.getElementById('groupImageURL').value = group.imageUrl || '';
            document.getElementById('groupDescription').value = group.description || '';
            document.getElementById('groupNotes').value = group.notes || '';
            document.getElementById('groupAutoBuy').checked = !!group.autoBuy;
            document.getElementById('groupConditionalVisibility').checked = !!group.conditionalVisibility;

            // Set form mode and id
            form.dataset.mode = 'edit';
            form.dataset.groupId = groupId;

            // Populate items for trigger selector and set trigger value after population
            populateItemSelector();
            setTimeout(() => {
                const selector = document.getElementById('groupTriggerItem');
                if (selector) selector.value = group.triggerItemId || '';
                // Ensure conditional selector visibility
                const conditionalItemSelector = document.getElementById('conditionalItemSelector');
                if (conditionalItemSelector) conditionalItemSelector.style.display = document.getElementById('groupConditionalVisibility').checked ? 'block' : 'none';
            }, 120);

            showModal('groupModal');
        }).catch(err => {
            console.error('Error fetching group for edit:', err);
            showToast('Error loading group: ' + (err.message || err), 'error');
        });
    } catch (err) {
        console.error('editGroup error:', err);
        showToast('Error editing group: ' + (err.message || err), 'error');
    }
}

async function deleteGroup(groupId, groupName) {
    console.log('Delete group:', groupId, groupName);
    if (!confirm(`Delete group "${groupName}" and remove group assignment from its items? This cannot be undone.`)) return;
    try {
        const listRef = db.collection('lists').doc(currentListId);
        const groupRef = listRef.collection('groups').doc(groupId);
        const itemsRef = listRef.collection('items');

        // Unset groupId on any items in the group
        const groupItemsSnap = await itemsRef.where('groupId', '==', groupId).get();
        const batch = db.batch();
        groupItemsSnap.forEach(doc => {
            batch.update(itemsRef.doc(doc.id), { groupId: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        // Delete the group document
        batch.delete(groupRef);
        await batch.commit();

        showToast('Group deleted and items updated', 'success');
        await loadListItems(currentListId);
    } catch (err) {
        console.error('Error deleting group:', err);
        showToast('Error deleting group: ' + (err.message || err), 'error');
    }
}

function showGroupInfo(groupId) {
    console.log('Show group info:', groupId);
    // Simple info display using modal: reuse group modal in read-only mode
    try {
        const groupRef = db.collection('lists').doc(currentListId).collection('groups').doc(groupId);
        groupRef.get().then(doc => {
            if (!doc.exists) { showToast('Group not found', 'error'); return; }
            const g = doc.data();
            // Use alert as a lightweight info view for now
            const txt = `Group: ${g.name || 'Untitled'}\n\n${g.description || ''}`;
            alert(txt);
        }).catch(err => console.error('Error loading group info:', err));
    } catch (err) {
        console.error('showGroupInfo error:', err);
    }
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
        const batch = db.batch();
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        
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
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
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
        const batch = db.batch();
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

// Move an entire group's items as a contiguous block to the requested position (composite like "2.1" or absolute like "7").
async function moveGroupToPosition(groupId, rawPosition) {
    if (!currentListId) {
        showToast('No active list selected', 'error');
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
        showToast('You don\'t have permission to move groups', 'error');
        return;
    }

    showLoading();
    try {
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        const baseAbsolute = await parseCompositeOrAbsolutePosition(String(rawPosition || '').trim(), itemsRef);

        // Fetch current ordering
        const snap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        snap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));

        // Extract group items in current order
        const selectedOrdered = allItems.filter(it => it.groupId === groupId);
        if (selectedOrdered.length === 0) {
            showToast('Group has no items to move', 'warning');
            hideLoading();
            return;
        }

        // Others are non-group items
        const others = allItems.filter(it => it.groupId !== groupId);

        // Map baseAbsolute to insertion index in others array considering visibility
        let insertionIndex = others.length;
        if (baseAbsolute <= allItems.length) {
            // Filter to only visible items
            const visibleItems = allItems.filter(it => !it.bought || showBoughtItems);
            const targetVisibleIdx = Math.max(0, baseAbsolute - 1);
            
            // Find the corresponding item in the full list
            const targetItem = visibleItems[targetVisibleIdx];
            if (targetItem) {
                const idxInOthers = others.findIndex(it => it.id === targetItem.id);
                if (idxInOthers !== -1) {
                    insertionIndex = idxInOthers;
                } else {
                    // Find the next visible item that's in others
                    let foundIdx = -1;
                    for (let i = targetVisibleIdx; i < visibleItems.length; i++) {
                        const j = others.findIndex(it => it.id === visibleItems[i].id);
                        if (j !== -1) { foundIdx = j; break; }
                    }
                    insertionIndex = foundIdx !== -1 ? foundIdx : others.length;
                }
            }
        } else {
            insertionIndex = others.length;
        }

        // Build new order
        const newOrder = [
            ...others.slice(0, insertionIndex),
            ...selectedOrdered,
            ...others.slice(insertionIndex)
        ];

        // Persist positions
        const batch = db.batch();
        newOrder.forEach((it, idx) => {
            batch.update(itemsRef.doc(it.id), {
                position: idx + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        // Update displayOrder for groups based on their new positions
        const groupsRef = db.collection('lists').doc(currentListId).collection('groups');
        const groupsBatch = db.batch();
        const groupDocs = await groupsRef.get();
        const groupsInOrder = Array.from(groupDocs.docs)
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.position - b.position);
        
        groupsInOrder.forEach((group, idx) => {
            groupsBatch.update(groupsRef.doc(group.id), {
                displayOrder: idx + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await groupsBatch.commit();

        showToast('Group moved successfully', 'success');
        await loadListItems(currentListId);
    } catch (err) {
        console.error('Error moving group:', err);
        showToast('Error moving group: ' + (err.message || err), 'error');
    } finally {
        hideLoading();
    }
}

async function moveItemToTop(itemId) {
    await moveItemToPosition(itemId, 1);
}

async function moveItemToMiddle(itemId) {
    if (!currentListId) {
        showToast('No active list selected', 'error');
        return;
    }

    showLoading();
    try {
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        const snap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        snap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));

        const middlePosition = Math.ceil(allItems.length / 2);
        await moveItemToPosition(itemId, middlePosition);
    } catch (err) {
        console.error('Error moving item to middle:', err);
        showToast('Error moving item to middle: ' + (err.message || err), 'error');
    } finally {
        hideLoading();
    }
}

async function moveItemToBottom(itemId) {
    if (!currentListId) {
        showToast('No active list selected', 'error');
        return;
    }

    showLoading();
    try {
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        const snap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        snap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));

        const bottomPosition = allItems.length + 1;
        await moveItemToPosition(itemId, bottomPosition);
    } catch (err) {
        console.error('Error moving item to bottom:', err);
        showToast('Error moving item to bottom: ' + (err.message || err), 'error');
    } finally {
        hideLoading();
    }
}

async function moveItemToPosition(itemId, targetPosition) {
    if (!currentListId) {
        showToast('No active list selected', 'error');
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
        const itemsRef = db.collection('lists').doc(currentListId).collection('items');
        
        // Fetch current ordering
        const snap = await itemsRef.orderBy('position', 'asc').get();
        const allItems = [];
        snap.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));

        // Find the item to move
        const itemToMove = allItems.find(item => item.id === itemId);
        if (!itemToMove) {
            showToast('Item not found', 'error');
            return;
        }

        // Remove the item from the array
        const otherItems = allItems.filter(item => item.id !== itemId);

        // Calculate insertion index
        let insertionIndex = Math.min(targetPosition - 1, otherItems.length);
        insertionIndex = Math.max(0, insertionIndex);

        // Insert the item at the new position
        const newOrder = [
            ...otherItems.slice(0, insertionIndex),
            itemToMove,
            ...otherItems.slice(insertionIndex)
        ];

        // Write back positions in a single batch
        const batch = db.batch();
        newOrder.forEach((item, idx) => {
            batch.update(itemsRef.doc(item.id), {
                position: idx + 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        showToast('Item moved successfully', 'success');
        // Reload items to reflect new order
        await loadListItems(currentListId);
    } catch (err) {
        console.error('Error moving item:', err);
        showToast('Error moving item: ' + (err.message || err), 'error');
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
    const effectiveCanEdit = canEdit && !showAsViewer;

    if (!effectiveCanEdit) return;
    
    // Track auto-scroll state
    let autoScrollInterval = null;
    let scrollSpeed = 0;
    
    new Sortable(container, {
        handle: '.drag-handle, .group-drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        filter: '.selection-action-bar', // Don't allow dragging the action bar
        scroll: document.documentElement, // Scroll the entire page/window
        scrollSpeed: 20, // Fast scroll speed
        scrollSensitivity: 100, // Trigger scroll when cursor is 100px from edge
        onEnd: async function(evt) {
            // After any drag end (item or group), rebuild the visible item ID order and persist positions
            try {
                const visibleIds = [];
                const groupPositions = new Map();
                let sequenceNumber = 1;
                
                // Walk through children in container order; expand groups into their item ids
                // Assign sequential numbers to both items and groups as they appear
                Array.from(container.children).forEach(child => {
                    if (child.classList.contains('item-card')) {
                        if (child.dataset && child.dataset.itemId) visibleIds.push(child.dataset.itemId);
                        // Update item position display
                        const posEl = child.querySelector('.item-position');
                        if (posEl) posEl.textContent = String(sequenceNumber);
                        sequenceNumber++;
                    } else if (child.classList.contains('group-container')) {
                        const groupId = child.dataset.groupId;
                        if (groupId) {
                            // Update the visible group number in the DOM
                            const header = child.querySelector('.group-title');
                            if (header) {
                                const groupNumber = header.querySelector('.group-number');
                                if (groupNumber) {
                                    groupNumber.textContent = `${sequenceNumber}.`;
                                }
                            }
                            groupPositions.set(groupId, sequenceNumber);
                            child.dataset.groupDisplayNumber = sequenceNumber;
                            sequenceNumber++;
                        }
                        // group-items-container may contain item-cards as direct children
                        const itemsContainer = child.querySelector('.group-items-container');
                        if (itemsContainer) {
                            Array.from(itemsContainer.querySelectorAll('.item-card')).forEach(ic => {
                                if (ic.dataset && ic.dataset.itemId) visibleIds.push(ic.dataset.itemId);
                            });
                        }
                    }
                });

                // Update group positions in database
                const groupsRef = db.collection('lists').doc(currentListId).collection('groups');
                const batch = db.batch();
                groupPositions.forEach((position, groupId) => {
                    batch.update(groupsRef.doc(groupId), {
                        position,
                        displayOrder: position,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();

                // Persist DOM order including groups (handles empty groups now)
                await persistDomOrder(container);
                showToast('Order updated', 'success');
            } catch (error) {
                console.error('Error persisting order after drag:', error);
                showToast('Error updating order: ' + (error.message || error), 'error');
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
    db.collection('lists').doc(currentListId).collection('groups')
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

    // Setup conditional visibility options
    setupItemConditionalVisibility();

    const itemNameInput = document.getElementById('itemName');
    const itemUrlInput = document.getElementById('itemURL');
    const urlValidationMessage = document.getElementById('urlValidationMessage');
    let typingTimer;
    const doneTypingInterval = 1000; // 1 second

    // URL validation function
    const validateUrlInput = () => {
        const url = itemUrlInput.value.trim();
        
        if (!url) {
            // Empty URL is valid (optional field)
            urlValidationMessage.textContent = '';
            urlValidationMessage.className = 'validation-message';
            itemUrlInput.classList.remove('invalid', 'valid');
            return;
        }
        
        const validatedUrl = validateAndFormatUrl(url);
        
        if (validatedUrl) {
            // Valid URL
            const protocol = validatedUrl.split(':')[0] + ':';
            let message = '✓ Valid URL';
            
            // Add protocol-specific messages
            if (protocol === 'mailto:') {
                message = '✓ Valid email address';
            } else if (protocol === 'tel:') {
                message = '✓ Valid phone number';
            } else if (protocol === 'sms:') {
                message = '✓ Valid SMS link';
            } else if (['http:', 'https:'].includes(protocol)) {
                message = '✓ Valid web URI';
            } else {
                message = `✓ Valid ${protocol} URI`;
            }
            
            urlValidationMessage.textContent = message;
            urlValidationMessage.className = 'validation-message success';
            itemUrlInput.classList.remove('invalid');
            itemUrlInput.classList.add('valid');
            
            // Update the input with the formatted URL
            if (validatedUrl !== url) {
                itemUrlInput.value = validatedUrl;
            }
        } else {
            // Invalid URI
            urlValidationMessage.textContent = '✗ Please enter a valid URI, email, phone number, or supported protocol';
            urlValidationMessage.className = 'validation-message error';
            itemUrlInput.classList.remove('valid');
            itemUrlInput.classList.add('invalid');
        }
    };

    // Define event handler function
    const handleItemNameInputEvent = () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            const itemName = itemNameInput.value.trim();
            if (itemName) {
                showLoading();
                const { generatedName, description, notes } = await summarizeItemName(itemName);
                // Only update if AI returns a valid generated name
                if (generatedName && generatedName.trim()) {
                    document.getElementById('itemName').value = generatedName; // Update item name input
                }
                document.getElementById('itemDescription').value = description;
                document.getElementById('itemNotes').value = notes;
                hideLoading();
            }
        }, doneTypingInterval);
    };

    // Remove any existing listeners to prevent duplicates before adding new ones
    itemNameInput.removeEventListener('input', itemNameInput._handleItemNameInputEvent);
    itemNameInput.removeEventListener('blur', itemNameInput._handleItemNameInputEvent);
    itemUrlInput.removeEventListener('input', itemUrlInput._handleUrlInputEvent);
    itemUrlInput.removeEventListener('blur', itemUrlInput._handleUrlInputEvent);

    // Store the function reference on the element itself to allow removal later
    itemNameInput._handleItemNameInputEvent = handleItemNameInputEvent;
    itemUrlInput._handleUrlInputEvent = validateUrlInput;

    // Add event listeners
    itemNameInput.addEventListener('input', itemNameInput._handleItemNameInputEvent);
    itemNameInput.addEventListener('blur', itemNameInput._handleItemNameInputEvent);
    itemUrlInput.addEventListener('input', itemUrlInput._handleUrlInputEvent);
    itemUrlInput.addEventListener('blur', itemUrlInput._handleUrlInputEvent);

    showModal('itemModal');
    

}

// Conditional visibility functions for items
function setupItemConditionalVisibility() {
    const conditionalCheckbox = document.getElementById('itemConditionalVisibility');
    const reliantOptions = document.getElementById('reliantOptions');

    // Populate item selector for reliant option
    populateItemSelectorForConditional();

    // Handle conditional visibility checkbox change
    conditionalCheckbox.addEventListener('change', function() {
        reliantOptions.style.display = this.checked ? 'block' : 'none';
    });
}

function populateItemSelectorForConditional() {
    const reliantSelector = document.getElementById('itemTriggerItem');
    
    if (!reliantSelector || !currentListId) return;
    
    // Clear existing options
    reliantSelector.innerHTML = '<option value="">Select an item...</option>';
    
    // Fetch items from Firestore
    db.collection('lists').doc(currentListId).collection('items')
        .orderBy('position')
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const data = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = data.name || 'Untitled';
                reliantSelector.appendChild(option);
            });
        })
        .catch(err => console.error('Error populating item selector:', err));
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
        db.collection('lists').doc(currentListId).collection('items')
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

        const groupRef = db.collection('lists').doc(currentListId).collection('groups');

        const form = document.getElementById('groupForm');
        let createdOrUpdatedGroupId = null;
        if (form.dataset.mode === 'edit' && form.dataset.groupId) {
            const { createdAt, ...updateData } = groupData;
            await groupRef.doc(form.dataset.groupId).update(updateData);
            createdOrUpdatedGroupId = form.dataset.groupId;
            showToast('Group updated!', 'success');
        } else {
            const docRef = await groupRef.add(groupData);
            createdOrUpdatedGroupId = docRef.id;
            showToast('Group added!', 'success');
        }

        // Optionally relocate group based on user input in the modal
        const rawPos = (document.getElementById('groupPosition') && document.getElementById('groupPosition').value || '').trim();
        hideModal('groupModal');
        if (rawPos && createdOrUpdatedGroupId) {
            try {
                await moveGroupToPosition(createdOrUpdatedGroupId, rawPos);
            } catch (err) {
                console.error('Error moving group after save:', err);
                showToast('Group saved but error moving group: ' + (err.message || err), 'error');
            }
        }
        // Refresh view to reflect changes
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
    const itemsRef = db.collection('lists').doc(currentListId).collection('items');
    
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
                
                // Add URL validation for edit mode
                const itemUrlInput = document.getElementById('itemURL');
                const urlValidationMessage = document.getElementById('urlValidationMessage');
                
                const validateUrlInput = () => {
                    const url = itemUrlInput.value.trim();
                    
                    if (!url) {
                        urlValidationMessage.textContent = '';
                        urlValidationMessage.className = 'validation-message';
                        itemUrlInput.classList.remove('invalid', 'valid');
                        return;
                    }
                    
                    const validatedUrl = validateAndFormatUrl(url);
                    
                    if (validatedUrl) {
                        const protocol = validatedUrl.split(':')[0] + ':';
                        let message = '✓ Valid URI';
                        
                        if (protocol === 'mailto:') {
                            message = '✓ Valid email address';
                        } else if (protocol === 'tel:') {
                            message = '✓ Valid phone number';
                        } else if (protocol === 'sms:') {
                            message = '✓ Valid SMS link';
                        } else if (['http:', 'https:'].includes(protocol)) {
                            message = '✓ Valid web URI';
                        } else {
                            message = `✓ Valid ${protocol} URI`;
                        }
                        
                        urlValidationMessage.textContent = message;
                        urlValidationMessage.className = 'validation-message success';
                        itemUrlInput.classList.remove('invalid');
                        itemUrlInput.classList.add('valid');
                        
                        if (validatedUrl !== url) {
                            itemUrlInput.value = validatedUrl;
                        }
                    } else {
                        urlValidationMessage.textContent = '✗ Please enter a valid URI, email, phone number, or supported protocol';
                        urlValidationMessage.className = 'validation-message error';
                        itemUrlInput.classList.remove('valid');
                        itemUrlInput.classList.add('invalid');
                    }
                };
                
                // Remove existing listeners and add new ones
                itemUrlInput.removeEventListener('input', itemUrlInput._handleUrlInputEvent);
                itemUrlInput.removeEventListener('blur', itemUrlInput._handleUrlInputEvent);
                itemUrlInput._handleUrlInputEvent = validateUrlInput;
                itemUrlInput.addEventListener('input', itemUrlInput._handleUrlInputEvent);
                itemUrlInput.addEventListener('blur', itemUrlInput._handleUrlInputEvent);
                
                // Initial validation
                validateUrlInput();
                
                // Show the modal first
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
    const itemsRef = db.collection('lists').doc(currentListId).collection('items');
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
    if (!url) return;
    
    // Handle different protocols appropriately
    if (url.startsWith('mailto:')) {
        window.location.href = url;
    } else if (url.startsWith('tel:') || url.startsWith('sms:') || url.startsWith('mms:')) {
        window.location.href = url;
    } else if (url.startsWith('facetime:')) {
        window.location.href = url;
    } else if (url.startsWith('geo:') || url.startsWith('maps:')) {
        window.location.href = url;
    } else {
        // Web URLs and other protocols - open in new tab
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
        const itemDoc = await db.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).get();
        
        if (!itemDoc.exists) {
            showToast('Item not found', 'error');
            return;
        }
        
        const item = itemDoc.data();
        
        // Mark the current item as bought
        await db.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).update({
                bought: true,
                buyerName: buyerName,
                buyerEmail: buyerEmail,
                buyerNote: buyerNote,
                datePurchased: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Check if item belongs to a group with auto-buy enabled
        if (item.groupId) {
            const groupDoc = await db.collection('lists').doc(currentListId)
                .collection('groups').doc(item.groupId).get();
            
            if (groupDoc.exists && groupDoc.data().autoBuy) {
                // Get all items in this group that are not yet bought
                const groupItemsSnapshot = await db.collection('lists').doc(currentListId)
                    .collection('items')
                    .where('groupId', '==', item.groupId)
                    .where('bought', '==', false)
                    .get();
                
                // Mark all other items in the group as bought
                const batch = firebase.firestore().batch();
                groupItemsSnapshot.forEach(doc => {
                    if (doc.id !== itemId) { // Don't update the item we just bought
                        const itemRef = db.collection('lists').doc(currentListId)
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
        await db.collection('lists').doc(currentListId)
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

async function unmarkAsBought(itemId) {
    if (!confirm('Are you sure you want to unmark this item as bought? This will erase all purchase data and cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).update({
                bought: false,
                buyerName: firebase.firestore.FieldValue.delete(),
                buyerEmail: firebase.firestore.FieldValue.delete(),
                buyerNote: firebase.firestore.FieldValue.delete(),
                datePurchased: firebase.firestore.FieldValue.delete()
            });
        
        showToast('Item unmarked as bought - purchase data erased!', 'success');
        loadListItems(currentListId);
    } catch (error) {
        showToast('Error unmarking item: ' + error.message, 'error');
    }
}

async function addComment(itemId) {
    if (!currentUser) {
        showToast('Please log in to add comments', 'error');
        return;
    }
    
    if (!currentListId) {
        showToast('No list selected', 'error');
        return;
    }
    
    if (!currentList) {
        showToast('List data not loaded', 'error');
        return;
    }
    
    // Check if user is a viewer (not owner, not collaborator)
    const isOwner = currentUser.email === currentList.owner;
    const collaboratorsField = currentList.collaborators || [];
    const isCollaborator = Array.isArray(collaboratorsField)
        ? collaboratorsField.includes(currentUser.email)
        : typeof collaboratorsField === 'object' && collaboratorsField !== null
            ? Object.values(collaboratorsField).includes(currentUser.email)
            : false;
    

    
    const commentInput = document.getElementById(`comment-input-${itemId}`);
    if (!commentInput) {
        showToast('Comment input not found', 'error');
        return;
    }
    
    const commentText = commentInput.value.trim();
    if (!commentText) {
        showToast('Please enter a comment', 'error');
        commentInput.focus();
        return;
    }
    
    try {
        // Get the current item to add the comment to its comments array
        const itemRef = db.collection('lists').doc(currentListId)
            .collection('items').doc(itemId);
        
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) {
            showToast('Item not found', 'error');
            return;
        }
        
        const itemData = itemDoc.data();
        const comments = itemData.comments || [];
        
        // Add the new comment
        const newComment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: commentText,
            authorEmail: currentUser.email,
            authorName: currentUser.displayName || currentUser.email,
            timestamp: firebase.firestore.Timestamp.now()
        };
        
        comments.push(newComment);
        
        // Update the item with the new comment
        await itemRef.update({
            comments: comments
        });
        
        // Clear the input
        commentInput.value = '';
        
        showToast('Comment added successfully!', 'success');
        
        // Reload the list items to show the new comment
        loadListItems(currentListId);
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Error adding comment: ' + error.message, 'error');
    }
}

function toggleCommentForm(itemId) {
    const formElement = document.getElementById(`add-comment-form-${itemId}`);
    const commentsSection = document.getElementById(`comments-section-${itemId}`);
    if (formElement && commentsSection) {
        const currentDisplay = formElement.style.display;
        const isShowing = currentDisplay === 'none';
        formElement.style.display = isShowing ? 'block' : 'none';
        
        // Show/hide gray line based on whether form is showing or there are comments
        const hasComments = commentsSection.querySelector('.comments-list') && 
                          commentsSection.querySelector('.comments-list').children.length > 0;
        commentsSection.style.borderTop = (isShowing || hasComments) ? '1px solid var(--divider)' : 'none';
    }
}

async function editComment(itemId, commentId, commentIndex) {
    if (!currentUser) {
        showToast('Please log in to edit comments', 'error');
        return;
    }
    
    try {
        // Get the current item and comment
        const itemRef = db.collection('lists').doc(currentListId).collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        
        if (!itemDoc.exists) {
            showToast('Item not found', 'error');
            return;
        }
        
        const itemData = itemDoc.data();
        const comments = itemData.comments || [];
        const comment = comments[commentIndex];
        
        if (!comment) {
            showToast('Comment not found', 'error');
            return;
        }
        
        // Check if user owns this comment
        if (comment.authorEmail !== currentUser.email) {
            showToast('You can only edit your own comments', 'error');
            return;
        }
        
        // Find the comment element in DOM
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) {
            showToast('Comment element not found', 'error');
            return;
        }
        
        const textElement = commentElement.querySelector('.comment-text');
        const originalText = comment.text;
        
        // Replace text with textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'comment-input';
        textarea.value = originalText;
        textarea.rows = 3;
        textarea.style.marginBottom = '8px';
        
        // Create action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';
        actionsDiv.style.marginTop = '8px';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.innerHTML = '<span class="material-icons" style="font-size: 16px; margin-right: 4px;">save</span>Save';
        saveBtn.onclick = async () => {
            const newText = textarea.value.trim();
            if (!newText) {
                showToast('Comment cannot be empty', 'error');
                return;
            }
            
            if (newText === originalText) {
                cancelEdit();
                return;
            }
            
            try {
                // Update comment in array
                comments[commentIndex] = {
                    ...comment,
                    text: newText,
                    editedAt: firebase.firestore.Timestamp.now()
                };
                
                // Update in Firestore
                await itemRef.update({ comments: comments });
                showToast('Comment updated successfully!', 'success');
                
                // Reload items to show updated comment
                await loadListItems(currentListId);
            } catch (error) {
                console.error('Error updating comment:', error);
                showToast('Error updating comment: ' + error.message, 'error');
            }
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.innerHTML = '<span class="material-icons" style="font-size: 16px; margin-right: 4px;">cancel</span>Cancel';
        cancelBtn.onclick = cancelEdit;
        
        function cancelEdit() {
            // Restore original text
            textElement.style.display = 'block';
            textarea.remove();
            actionsDiv.remove();
        }
        
        // Replace text with editing interface
        textElement.style.display = 'none';
        textElement.parentNode.insertBefore(textarea, textElement);
        textElement.parentNode.insertBefore(actionsDiv, textElement.nextSibling);
        actionsDiv.appendChild(saveBtn);
        actionsDiv.appendChild(cancelBtn);
        
        // Focus textarea
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
    } catch (error) {
        console.error('Error editing comment:', error);
        showToast('Error editing comment: ' + error.message, 'error');
    }
}

async function deleteComment(itemId, commentId, commentIndex) {
    if (!currentUser) {
        showToast('Please log in to delete comments', 'error');
        return;
    }
    
    try {
        // Get current item and comment
        const itemRef = db.collection('lists').doc(currentListId).collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        
        if (!itemDoc.exists) {
            showToast('Item not found', 'error');
            return;
        }
        
        const itemData = itemDoc.data();
        const comments = itemData.comments || [];
        const comment = comments[commentIndex];
        
        if (!comment) {
            showToast('Comment not found', 'error');
            return;
        }
        
        // Check if user owns this comment
        if (comment.authorEmail !== currentUser.email) {
            showToast('You can only delete your own comments', 'error');
            return;
        }
        
        // Confirm deletion
        const confirmMessage = `Are you sure you want to delete this comment?\n\n"${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Remove comment from array
        comments.splice(commentIndex, 1);
        
        // Update in Firestore
        await itemRef.update({ comments: comments });
        showToast('Comment deleted successfully!', 'success');
        
        // Reload items to reflect changes
        await loadListItems(currentListId);
        
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Error deleting comment: ' + error.message, 'error');
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
        const groupsSnap = await db.collection('lists').doc(currentListId).collection('groups').get();
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



function validateAndFormatUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    
    // Trim whitespace
    url = url.trim();
    
    // If URL is empty, return empty string
    if (!url) {
        return '';
    }
    
    // Define supported protocols
    const supportedProtocols = {
        // Web protocols
        'http:': true,
        'https:': true,
        // Communication protocols
        'mailto:': true,
        'tel:': true,
        'sms:': true,
        'mms:': true,
        // App protocols
        'facetime:': true,
        'skype:': true,
        'zoommtg:': true,
        'teams:': true,
        'slack:': true,
        'discord:': true,
        // Location protocols
        'geo:': true,
        'maps:': true,
        // Media protocols
        'spotify:': true,
        'itunes:': true,
        'podcast:': true,
        // Social protocols
        'twitter:': true,
        'facebook:': true,
        'instagram:': true,
        'linkedin:': true,
        // Other common protocols
        'bitcoin:': true,
        'ethereum:': true,
        'magnet:': true
    };
    
    // Check if it's already a valid URL with protocol
    try {
        // Try to create URL object to validate basic structure
        const urlObj = new URL(url);
        
        // Check if protocol is supported
        if (supportedProtocols[urlObj.protocol]) {
            return url;
        } else {
            // Unsupported protocol or malformed like localhost:
            // Special case: if it looks like localhost with port, handle it
            if (/^localhost:\d+$/.test(url)) {
                return 'https://' + url;
            }
            return '';
        }
    } catch (e) {
        // URL constructor failed, might be missing protocol
    }
    
    // Special handling for email addresses (convert to mailto:)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) {
        return 'mailto:' + url;
    }
    
    // Special handling for phone numbers (convert to tel:)
    if (/^[\+]?[1-9][\d]{0,15}$/.test(url.replace(/[\s\-\(\)]/g, ''))) {
        return 'tel:' + url;
    }
    
    // If we get here, URL might be missing protocol
    // First check if it looks like localhost with port or IP with port
    if (/^localhost(:\d+)?$/.test(url) || 
        /^127\.\d+\.\d+\.\d+(:\d+)?$/.test(url) ||
        /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(url)) {
        return 'https://' + url;
    }
    
    // Try adding https:// first for web URLs
    try {
        const urlWithHttps = new URL('https://' + url);
        
        // Basic validation for domain
        if (urlWithHttps.hostname && 
            (urlWithHttps.hostname.includes('.') || 
             urlWithHttps.hostname === 'localhost' ||
             urlWithHttps.hostname.startsWith('localhost') ||
             /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(urlWithHttps.hostname))) {
            
            return 'https://' + url;
        }
    } catch (e) {
        // Still invalid
    }
    
    // Try adding http:// as fallback for web URLs
    try {
        const urlWithHttp = new URL('http://' + url);
        
        // Basic validation for domain
        if (urlWithHttp.hostname && 
            (urlWithHttp.hostname.includes('.') || 
             urlWithHttp.hostname === 'localhost' ||
             urlWithHttp.hostname.startsWith('localhost') ||
             /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(urlWithHttp.hostname))) {
            
            return 'http://' + url;
        }
    } catch (e) {
        // Still invalid
    }
    
    // If all attempts failed, return empty string
    return '';
}

async function saveItem() {
    const form = document.getElementById('itemForm');
    const formData = new FormData(form);

    // Determine desired absolute position from input; support composite like "G.I" or absolute numbers; default to append at end
    const posInputEl = document.getElementById('itemPosition');
    const rawPos = posInputEl ? (posInputEl.value || '').trim() : '';
    const itemsRef = db.collection('lists').doc(currentListId).collection('items');
    const desiredPosition = await parseCompositeOrAbsolutePosition(rawPos, itemsRef);
    
    const conditionalVisibility = document.getElementById('itemConditionalVisibility').checked;
    const itemName = document.getElementById('itemName').value;
    
    // Debug logging
    console.log('Item name being saved:', itemName);
    
    // Get and validate URL
    const rawUrl = document.getElementById('itemURL').value.trim();
    let validatedUrl = '';
    
    if (rawUrl) {
        // Validate and format URL
        validatedUrl = validateAndFormatUrl(rawUrl);
        if (!validatedUrl) {
            showToast('Please enter a valid URI', 'error');
            return;
        }
    }
    
    const itemData = {
        name: itemName,
        url: validatedUrl,
        description: document.getElementById('itemDescription').value,
        imageUrl: document.getElementById('itemImageURL').value,
        notes: document.getElementById('itemNotes').value,
        price: document.getElementById('itemPrice').value || null,
        position: desiredPosition,
        bought: false,
        groupId: document.getElementById('itemGroup').value || null,
        conditionalVisibility: conditionalVisibility || false,
        triggerItemId: conditionalVisibility ? document.getElementById('itemTriggerItem').value : null,
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
            await db.collection('lists').doc(currentListId)
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
            await db.collection('lists').doc(currentListId)
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
    const itemsRef = db.collection('lists').doc(currentListId).collection('items');
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

// AI Summarization functions
async function summarizeItem(itemId) {
    try {
        // Get the item details
        const itemDoc = await db.collection('lists').doc(currentListId).collection('items').doc(itemId).get();
        const item = itemDoc.data();
        if (!item) {
            showToast('Item not found', 'error');
            return;
        }

        // Get the list's Gemini API key if available
        const listDoc = await db.collection('lists').doc(currentListId).get();
        const list = listDoc.data();
        const apiKey = list.geminiApiKey;

        if (!apiKey) {
            // Show popup to enter API key
            const modal = document.getElementById('apiKeyModal') || createApiKeyModal();
            modal.dataset.itemId = itemId;
            showModal('apiKeyModal');
            return;
        }

        // Use existing item name for summarization
        await performItemSummarization(itemId, item.name, apiKey);
    } catch (error) {
        console.error('Error in summarizeItem:', error);
        showToast('Error summarizing item', 'error');
    }
}

function createApiKeyModal() {
    const modal = document.createElement('div');
    modal.id = 'apiKeyModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Enter Gemini API Key</h2>
            <p>An API key is required for AI summarization.</p>
            <input type="text" id="tempApiKey" class="input" placeholder="Enter Gemini API Key">
            <div class="modal-buttons">
                <button onclick="hideModal('apiKeyModal')" class="btn btn-secondary">Cancel</button>
                <button onclick="handleTempApiKey()" class="btn btn-primary">Summarize</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

async function handleTempApiKey() {
    const apiKey = document.getElementById('tempApiKey').value.trim();
    const modal = document.getElementById('apiKeyModal');
    const itemId = modal.dataset.itemId;

    if (!apiKey) {
        showToast('Please enter an API key', 'error');
        return;
    }

    try {
        const itemDoc = await db.collection('lists').doc(currentListId).collection('items').doc(itemId).get();
        const item = itemDoc.data();
        
        hideModal('apiKeyModal');
        await performItemSummarization(itemId, item.name, apiKey);
    } catch (error) {
        console.error('Error in handleTempApiKey:', error);
        showToast('Error summarizing item', 'error');
    }
}

async function performItemSummarization(itemId, itemName, apiKey) {
    showLoading();
    try {
        const result = await summarizeItemName(itemName, apiKey);
        if (result && result.description) {
            await db.collection('lists').doc(currentListId).collection('items').doc(itemId).update({
                description: result.description,
                notes: result.notes || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Item summarized successfully', 'success');
            await loadList(currentListId); // Refresh the list to show the new description
        }
    } catch (error) {
        console.error('Error in performItemSummarization:', error);
        showToast('Error summarizing item', 'error');
    } finally {
        hideLoading();
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
        
        const nativeShareViewer = document.getElementById('nativeShareViewer');
        if (nativeShareViewer) {
            nativeShareViewer.addEventListener('click', () => nativeShareList('viewer'));
        } else {
            console.error('Element not found: nativeShareViewer');
        }
        
        const nativeShareCollab = document.getElementById('nativeShareCollab');
        if (nativeShareCollab) {
            nativeShareCollab.addEventListener('click', () => nativeShareList('collaborator'));
        } else {
            console.error('Element not found: nativeShareCollab');
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
    document.getElementById('editListEventDate').value = formatDateForInput(currentList.eventDate);
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
    
    const listRef = db.collection('lists').doc(currentListId);
    const updateData = {};
    updateData[role] = firebase.firestore.FieldValue.arrayRemove(emailToRemove);
    
    listRef.update(updateData)
        .then(() => {
            showToast(`User removed from ${role}`, 'success');
            // Refresh the list in the modal
            return db.collection('lists').doc(currentListId).get();
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
    db.collection('users').where('email', '==', email).get()
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
            const listRef = db.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[rolePath] = firebase.firestore.FieldValue.arrayUnion(userData.email);
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return db.collection('lists').doc(currentListId).get();
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
    const listRef = db.collection('lists').doc(currentListId);
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

async function nativeShareList(type = 'viewer') {
    try {
        if (!currentListId) {
            console.error('Cannot share: No list is currently loaded');
            showToast('Cannot share: No list is currently loaded', 'error');
            return;
        }
        
        // Check if Web Share API is supported
        if (!navigator.share) {
            console.log('Web Share API not supported, falling back to copying link');
            showToast('Share menu not supported on this device. Link copied to clipboard instead.', 'warning');
            copyShareLink(type);
            return;
        }
        
        const shareUrl = generateShareUrl(type);
        const listTitle = currentList?.name || 'Wishlist';
        const accessType = type === 'collaborator' ? 'with edit access' : 'with view-only access';
        const listDescription = currentList?.description || `Check out my wishlist ${accessType}!`;
        
        const shareData = {
            title: listTitle,
            text: listDescription,
            url: shareUrl
        };
        
        console.log(`Attempting to use native share API for ${type} role`);
        await navigator.share(shareData);
        console.log(`Successfully shared ${type} link using native share API`);
        showToast('Shared successfully!', 'success');
        
    } catch (error) {
        console.error('Error using native share:', error);
        
        // Handle different error cases
        if (error.name === 'AbortError') {
            console.log('Share was cancelled by user');
            // Don't show toast for user cancellation
        } else if (error.name === 'NotAllowedError') {
            showToast('Share permission denied. Link copied to clipboard instead.', 'warning');
            copyShareLink(type);
        } else {
            console.error('Unexpected error during share:', error);
            showToast('Share failed. Link copied to clipboard instead.', 'warning');
            copyShareLink(type);
        }
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
        
        const qrDiv = document.getElementById('qrCanvas');
        const container = document.getElementById('qrCodeContainer');
        
        // Clear any existing QR code completely
        qrDiv.innerHTML = '';
        // Remove any existing QR code elements that might have been added by the library
        while (qrDiv.firstChild) {
            qrDiv.removeChild(qrDiv.firstChild);
        }
        
        // Also remove any fallback element that might exist
        const fallbackElement = document.getElementById('qrFallback');
        if (fallbackElement) {
            fallbackElement.remove();
        }
        
        // Reset canvas display
        qrDiv.style.display = 'block';
        
        // Check if QRCode library is available
        console.log('typeof QRCode:', typeof QRCode);
        if (typeof QRCode !== 'undefined') {
            try {
                 new QRCode(qrDiv, {
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
                 showFallbackQRCode(url, container, qrDiv);
             }
        } else {
            showFallbackQRCode(url, container, qrDiv);
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



function toggleViewerMode() {
    const toggle = document.getElementById('showAsViewerToggle');
    if (toggle) {
        showAsViewer = toggle.checked;
        showBoughtItems = toggle.checked;
    }
    if (currentListId) {
        loadListItems(currentListId);
    }
}

function toggleExtensiveMovingButtons() {
    const toggle = document.getElementById('showExtensiveMovingToggle');
    if (toggle) {
        showExtensiveMovingButtons = toggle.checked;
    }
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

// Helper function to convert eventDate to YYYY-MM-DD format for date input
function formatDateForInput(dateObj) {
    try {
        if (!dateObj) {
            return '';
        }
        
        let date;
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                date = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return '';
            }
        } else if (dateObj instanceof Date) {
            date = dateObj;
        } else if (typeof dateObj === 'string') {
            // If it's already in YYYY-MM-DD format, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateObj)) {
                return dateObj;
            }
            // Otherwise, try to parse it as a date
            try {
                date = new Date(dateObj);
            } catch (error) {
                console.error('Error parsing date string:', error);
                return '';
            }
        } else {
            return '';
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date object provided to formatDateForInput');
            return '';
        }
        
        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error in formatDateForInput:', error);
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
    if (!currentList) {
        console.error('showEditModal: currentList is null');
        return;
    }
    
    console.log('showEditModal: currentList.eventDate =', currentList.eventDate);
    console.log('showEditModal: typeof currentList.eventDate =', typeof currentList.eventDate);
    
    // Populate the edit modal with list details
    document.getElementById('editListName').value = currentList.name;
    document.getElementById('editListDescription').value = currentList.description || '';
    
    // Format and set the event date
    const formattedDate = formatDateForInput(currentList.eventDate);
    console.log('showEditModal: formattedDate =', formattedDate);
    const eventDateInput = document.getElementById('editListEventDate');
    eventDateInput.value = formattedDate;
    console.log('showEditModal: eventDateInput.value after setting =', eventDateInput.value);
    
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
    
    const listRef = db.collection('lists').doc(currentListId);
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
    db.collection('users').where('email', '==', email).get()
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
            const listRef = db.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[`${rolePath}.${userId}`] = userData.email;
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return db.collection('lists').doc(currentListId).get();
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
    
    const listRef = db.collection('lists').doc(currentListId);
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

                    const listItemsCollectionRef = db.collection('lists').doc(currentListId).collection('items');

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
            await db.collection('lists').doc(currentListId).collection('items').doc(itemId).delete();
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

// Helper function to convert eventDate to YYYY-MM-DD format for date input
function formatDateForInput(dateObj) {
    try {
        if (!dateObj) {
            return '';
        }
        
        let date;
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                date = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return '';
            }
        } else if (dateObj instanceof Date) {
            date = dateObj;
        } else if (typeof dateObj === 'string') {
            // If it's already in YYYY-MM-DD format, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateObj)) {
                return dateObj;
            }
            // Otherwise, try to parse it as a date
            try {
                date = new Date(dateObj);
            } catch (error) {
                console.error('Error parsing date string:', error);
                return '';
            }
        } else {
            return '';
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date object provided to formatDateForInput');
            return '';
        }
        
        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error in formatDateForInput:', error);
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
    if (!currentList) {
        console.error('showEditModal: currentList is null');
        return;
    }
    
    console.log('showEditModal: currentList.eventDate =', currentList.eventDate);
    console.log('showEditModal: typeof currentList.eventDate =', typeof currentList.eventDate);
    
    // Populate the edit modal with list details
    document.getElementById('editListName').value = currentList.name;
    document.getElementById('editListDescription').value = currentList.description || '';
    
    // Format and set the event date
    const formattedDate = formatDateForInput(currentList.eventDate);
    console.log('showEditModal: formattedDate =', formattedDate);
    const eventDateInput = document.getElementById('editListEventDate');
    eventDateInput.value = formattedDate;
    console.log('showEditModal: eventDateInput.value after setting =', eventDateInput.value);
    
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
    
    const listRef = db.collection('lists').doc(currentListId);
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
    db.collection('users').where('email', '==', email).get()
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
            const listRef = db.collection('lists').doc(currentListId);
            const updateData = {};
            const rolePath = role === 'collaborator' ? 'collaborators' : 'viewers';
            updateData[`${rolePath}.${userId}`] = userData.email;
            
            return listRef.update(updateData);
        })
        .then(() => {
            showToast(`User added as ${role}`, 'success');
            document.getElementById(inputId).value = '';
            
            // Refresh the current list data
            return db.collection('lists').doc(currentListId).get();
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
    
    const listRef = db.collection('lists').doc(currentListId);
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

// Helper function to convert eventDate to YYYY-MM-DD format for date input
function formatDateForInput(dateObj) {
    try {
        if (!dateObj) {
            return '';
        }
        
        let date;
        
        // Handle Firebase Timestamp objects
        if (dateObj.toDate && typeof dateObj.toDate === 'function') {
            try {
                date = dateObj.toDate();
            } catch (error) {
                console.error('Error converting Firebase timestamp:', error);
                return '';
            }
        } else if (dateObj instanceof Date) {
            date = dateObj;
        } else if (typeof dateObj === 'string') {
            // If it's already in YYYY-MM-DD format, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateObj)) {
                return dateObj;
            }
            // Otherwise, try to parse it as a date
            try {
                date = new Date(dateObj);
            } catch (error) {
                console.error('Error parsing date string:', error);
                return '';
            }
        } else {
            return '';
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date object provided to formatDateForInput');
            return '';
        }
        
        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error in formatDateForInput:', error);
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
