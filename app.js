// Global state
let currentUser = null;
let currentList = null;
let currentListId = null;
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
        const listId = urlParams.get('list');
        const itemId = urlParams.get('item');
        
        if (listId) {
            console.log('List ID found in URL:', listId);
            currentListId = listId;
            // Store in localStorage for quick access
            localStorage.setItem('lastViewedList', listId);
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
                console.log('User details:', user.email, user.uid);
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

function onUserSignedIn() {
    console.log('User signed in:', currentUser);
    try {
        hideLoading();
        document.getElementById('loginButton').classList.add('hidden');
        document.getElementById('userBtn').classList.remove('hidden');
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userUid').textContent = currentUser.uid;

        console.log('Checking for specific list ID in URL:', currentListId);
        if (currentListId) {
            // Load specific list from URL
            console.log('Loading specific list:', currentListId);
            loadList(currentListId);
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
            logoutButton.addEventListener('click', signOut);
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
    const isCollaborator = currentUser && list.collaborators.includes(currentUser.email);
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
        
        console.log('Loading items for list:', listId);
        const itemsQuery = firebaseDb.collection('lists').doc(listId)
            .collection('items').orderBy('position', 'asc');
        
        const snapshot = await itemsQuery.get();
        const items = [];
        
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`Loaded ${items.length} items for list ${listId}`);
        displayItems(items);
        setupDragAndDrop();
        clearTimeout(safetyTimeout);
    } catch (error) {
        console.error('Error loading items:', error);
        clearTimeout(safetyTimeout);
        showToast('Error loading items: ' + error.message, 'error');
    }
}

function displayItems(items) {
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
    
    items.forEach((item, index) => {
        if (!showBoughtItems && item.bought) return;
        
        const itemCard = createItemCard(item, index + 1);
        container.appendChild(itemCard);
    });
}

function createItemCard(item, position) {
    const card = document.createElement('div');
    card.className = `item-card ${item.bought ? 'bought' : ''} ${selectedItems.includes(item.id) ? 'selected' : ''}`;
    card.dataset.itemId = item.id;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const isCollaborator = currentUser && currentList.collaborators.includes(currentUser.email);
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
    
    contentWrapper.innerHTML = `
        <div class="item-position">${position}</div>
        <div class="item-header">
            <h3 class="item-title">${escapeHtml(item.name)}</h3>
            <div class="item-actions">
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
    const isCollaborator = currentUser && currentList.collaborators.includes(currentUser.email);
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

function setupDragAndDrop() {
    const container = document.getElementById('itemsContainer');
    if (container.children.length === 0) return;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const isCollaborator = currentUser && currentList.collaborators.includes(currentUser.email);
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

// Item management functions
function showAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Add Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemForm').dataset.mode = 'add';
    
    // Clear description and notes fields
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemNotes').value = '';

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
    const buyerName = prompt('Enter your name:');
    if (!buyerName) return;
    
    const buyerEmail = prompt('Enter your email (optional):') || '';
    const buyerNote = prompt('Add a note (optional):') || '';
    
    try {
        await firebaseDb.collection('lists').doc(currentListId)
            .collection('items').doc(itemId).update({
                bought: true,
                buyerName: buyerName,
                buyerEmail: buyerEmail,
                buyerNote: buyerNote,
                datePurchased: firebase.firestore.FieldValue.serverTimestamp()
            });
        showToast('Item marked as bought!', 'success');
        loadListItems(currentListId);
    } catch (error) {
        showToast('Error marking item as bought: ' + error.message, 'error');
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

async function saveItem() {
    const form = document.getElementById('itemForm');
    const formData = new FormData(form);
    
    const itemData = {
        name: document.getElementById('itemName').value,
        url: document.getElementById('itemURL').value,
        description: document.getElementById('itemDescription').value,
        imageUrl: document.getElementById('itemImageURL').value,
        notes: document.getElementById('itemNotes').value,
        price: document.getElementById('itemPrice').value || null,
        position: (await firebaseDb.collection('lists').doc(currentListId).collection('items').get()).size + 1,
        bought: false,
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
            
            // Don't override position and creation date for edits
            delete itemData.position;
            delete itemData.createdAt;
            
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
    await firebaseDb.collection('lists').doc(currentListId)
        .collection('items').doc(itemId).update({
            position: newPosition,
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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${window.geminiApiKey}`;

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
    if (!currentUser || !currentList || (!currentList.owner === currentUser.email && !currentList.collaborators.includes(currentUser.email))) {
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