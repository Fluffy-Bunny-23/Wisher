// Global state
let currentUser = null;
let currentList = null;
let currentListId = null;
let showBoughtItems = false;
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';

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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupAuthStateListener();
});

function initializeApp() {
    // Check for list ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list');
    const itemId = urlParams.get('item');
    
    if (listId) {
        currentListId = listId;
        // Store in localStorage for quick access
        localStorage.setItem('lastViewedList', listId);
    }
}
    
    // Load settings
    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey) {
        geminiApiKey = savedApiKey;
        document.getElementById('geminiApiKey').value = savedApiKey;
    }
// This closing brace belongs to initializeApp() function


function setupAuthStateListener() {
    firebaseAuth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            onUserSignedIn();
        } else {
            currentUser = null;
            onUserSignedOut();
        }
    });
}

function onUserSignedIn() {
    hideLoading();
    
    if (currentListId) {
        // Load specific list from URL
        loadList(currentListId);
    } else {
        // Show user's lists
        showScreen('listScreen');
        loadUserLists();
    }
}

function onUserSignedOut() {
    hideLoading();
    showScreen('authScreen');
    currentList = null;
    currentListId = null;
}

function setupEventListeners() {
    // Auth buttons
    document.getElementById('googleSignIn').addEventListener('click', signInWithGoogle);
    document.getElementById('emailSignIn').addEventListener('click', toggleEmailAuth);
    document.getElementById('signInBtn').addEventListener('click', signInWithEmail);
    document.getElementById('signUpBtn').addEventListener('click', signUpWithEmail);
    
    // App bar buttons
    document.getElementById('helpBtn').addEventListener('click', () => showModal('helpModal'));
    document.getElementById('settingsBtn').addEventListener('click', () => showModal('settingsModal'));
    document.getElementById('shareBtn').addEventListener('click', () => showModal('shareModal'));
    document.getElementById('userBtn').addEventListener('click', signOut);
    
    // List management
    document.getElementById('createListBtn').addEventListener('click', createNewList);
    document.getElementById('addItemBtn').addEventListener('click', () => showAddItemModal());
    document.getElementById('manageListBtn').addEventListener('click', () => showEditModal());
    
    // Modals
    document.getElementById('saveItemBtn').addEventListener('click', saveItem);
    document.getElementById('cancelItemBtn').addEventListener('click', () => hideModal('itemModal'));
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('cancelSettingsBtn').addEventListener('click', () => hideModal('settingsModal'));
    document.getElementById('saveEditBtn').addEventListener('click', saveListEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', () => hideModal('editModal'));
    document.getElementById('addCollaboratorBtn').addEventListener('click', addCollaborator);
    document.getElementById('addViewerBtn').addEventListener('click', addViewer);
    
    // Show bought items toggle
    document.getElementById('showBoughtToggle').addEventListener('change', toggleBoughtItems);
    
    // Share buttons
    setupShareButtons();
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal.id);
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // Sidebar event listeners
    menuButton.addEventListener('click', toggleSidebar);
    sidebarCloseBtn.addEventListener('click', toggleSidebar);
    createListSidebarBtn.addEventListener('click', () => {
        toggleSidebar();
        createNewList();
    });
    // Add event delegation for sidebar list items after they are loaded
    sidebarListContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI' && e.target.dataset.listId) {
            toggleSidebar();
            loadList(e.target.dataset.listId);
        }
    });
}

// Authentication functions
async function signInWithGoogle() {
    try {
        showLoading();
        await firebaseAuth.signInWithPopup(googleProvider);
    } catch (error) {
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
    if (!currentUser) return;
    
    try {
        showLoading();
        const listsQuery = firebaseDb.collection('lists')
            .where('owner', '==', currentUser.email);
        
        const collaboratorQuery = firebaseDb.collection('lists')
            .where('collaborators', 'array-contains', currentUser.email);
        
        const [ownedLists, collaboratorLists] = await Promise.all([
            listsQuery.get(),
            collaboratorQuery.get()
        ]);
        
        const allLists = [];
        ownedLists.forEach(doc => {
            allLists.push({ id: doc.id, ...doc.data(), role: 'owner' });
        });
        
        collaboratorLists.forEach(doc => {
            if (!allLists.find(list => list.id === doc.id)) {
                allLists.push({ id: doc.id, ...doc.data(), role: 'collaborator' });
            }
        });
        
        displayLists(allLists);
        hideLoading();
    } catch (error) {
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
    try {
        showLoading();
        const listDoc = await firebaseDb.collection('lists').doc(listId).get();
        
        if (!listDoc.exists) {
            showToast('List not found', 'error');
            showScreen('listScreen');
            return;
        }
        
        currentList = { id: listDoc.id, ...listDoc.data() };
        currentListId = listId;
        
        // Update URL without reloading
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('list', listId);
        window.history.replaceState({}, '', newUrl);
        
        displayList(currentList);
        loadListItems(listId);
        showScreen('wishlistScreen');
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('Error loading list: ' + error.message, 'error');
    }
}

function displayList(list) {
    document.getElementById('listTitle').textContent = list.name;
    document.getElementById('listEventDate').textContent = 
        list.eventDate ? `Event: ${formatDate(list.eventDate)}` : '';
    
    // Set up permissions
    const isOwner = currentUser && currentUser.email === list.owner;
    const isCollaborator = currentUser && list.collaborators.includes(currentUser.email);
    const canEdit = isOwner || isCollaborator;
    
    document.getElementById('addItemBtn').style.display = canEdit ? 'flex' : 'none';
    document.getElementById('manageListBtn').style.display = isOwner ? 'flex' : 'none';
}

async function loadListItems(listId) {
    try {
        const itemsQuery = firebaseDb.collection('lists').doc(listId)
            .collection('items').orderBy('position', 'asc');
        
        const snapshot = await itemsQuery.get();
        const items = [];
        
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        displayItems(items);
        setupDragAndDrop();
    } catch (error) {
        showToast('Error loading items: ' + error.message, 'error');
    }
}

function displayItems(items) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <p>No items in this list yet. Add some items to get started!</p>
            </div>
        `;
        return;
    }
    
    items.forEach((item, index) => {
        if (!showBoughtItems && item.bought) return;
        
        const itemCard = createItemCard(item, index + 1);
        container.appendChild(itemCard);
    });
}

function createItemCard(item, position) {
    const card = document.createElement('div');
    card.className = `item-card ${item.bought ? 'bought' : ''}`;
    card.dataset.itemId = item.id;
    
    const isOwner = currentUser && currentUser.email === currentList.owner;
    const isCollaborator = currentUser && currentList.collaborators.includes(currentUser.email);
    const canEdit = isOwner || isCollaborator;
    
    // Add click event listener to show info modal when card is clicked
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking on a button or link
        if (!e.target.closest('button') && !e.target.closest('a')) {
            showItemInfo(item.id);
        }
    });
    
    card.innerHTML = `
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
    
    return card;
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
    showModal('itemModal');
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
    const apiKey = document.getElementById('geminiApiKey').value;
    
    if (apiKey) {
        localStorage.setItem('geminiApiKey', apiKey);
        geminiApiKey = apiKey;
    } else {
        localStorage.removeItem('geminiApiKey');
        geminiApiKey = '';
    }
    
    showToast('Settings saved!', 'success');
    hideModal('settingsModal');
}

// Share functions
function setupShareButtons() {
    document.getElementById('copyViewerLink').addEventListener('click', () => copyShareLink('viewer'));
    document.getElementById('copyCollabLink').addEventListener('click', () => copyShareLink('collaborator'));
    document.getElementById('qrViewerCode').addEventListener('click', () => generateQRCode('viewer'));
    document.getElementById('qrCollabCode').addEventListener('click', () => generateQRCode('collaborator'));
    document.getElementById('emailViewerLink').addEventListener('click', () => emailShareLink('viewer'));
    document.getElementById('emailCollabLink').addEventListener('click', () => emailShareLink('collaborator'));
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
    const eventDate = document.getElementById('editListDate').value;
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
        document.getElementById('listName').textContent = name;
        document.getElementById('listDescription').textContent = description || 'No description';
        document.getElementById('listDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    const url = generateShareUrl(type);
    copyToClipboard(url);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Copied to clipboard!', 'success');
        })
        .catch(err => {
            showToast('Failed to copy text', 'error');
        });
}

function generateShareUrl(type) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?list=${currentListId}&role=${type}`;
}

function generateQRCode(type) {
    const url = generateShareUrl(type);
    const canvas = document.getElementById('qrCanvas');
    const container = document.getElementById('qrCodeContainer');
    
    try {
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
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showFallbackQRCode(url, container, canvas);
    }
}

function showFallbackQRCode(url, container, canvas) {
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
        <div class="share-url">${url}</div>
        <button class="btn btn-primary" onclick="copyToClipboard('${url}')">Copy URL</button>
    `;
    
    // Show the container
    container.classList.remove('hidden');
}

function emailShareLink(type) {
    const url = generateShareUrl(type);
    const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
    const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateObj) {
    if (!dateObj) return 'Not available';
    
    // Handle Firebase Timestamp objects
    if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        dateObj = dateObj.toDate();
    } else if (!(dateObj instanceof Date)) {
        // Try to convert to Date if it's not already a Date object
        dateObj = new Date(dateObj);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    const url = generateShareUrl(type);
    const shareData = {
        title: `Wishlist: ${currentList.name}`,
        text: `Check out this wishlist!`,
        url: url
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            // Fallback to copy link
            copyShareLink(type);
        });
    } else {
        // Fallback to copy link
        copyShareLink(type);
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
    const eventDate = document.getElementById('editListDate').value;
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
        document.getElementById('listName').textContent = name;
        document.getElementById('listDescription').textContent = description || 'No description';
        document.getElementById('listDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    const url = generateShareUrl(type);
    copyToClipboard(url);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Copied to clipboard!', 'success');
        })
        .catch(err => {
            showToast('Failed to copy text', 'error');
        });
}

function generateShareUrl(type) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?list=${currentListId}&role=${type}`;
}

function generateQRCode(type) {
    const url = generateShareUrl(type);
    const canvas = document.getElementById('qrCanvas');
    const container = document.getElementById('qrCodeContainer');
    
    try {
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
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showFallbackQRCode(url, container, canvas);
    }
}

function showFallbackQRCode(url, container, canvas) {
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
        <div class="share-url">${url}</div>
        <button class="btn btn-primary" onclick="copyToClipboard('${url}')">Copy URL</button>
    `;
    
    // Show the container
    container.classList.remove('hidden');
}

function emailShareLink(type) {
    const url = generateShareUrl(type);
    const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
    const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateObj) {
    if (!dateObj) return 'Not available';
    
    // Handle Firebase Timestamp objects
    if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        dateObj = dateObj.toDate();
    } else if (!(dateObj instanceof Date)) {
        // Try to convert to Date if it's not already a Date object
        dateObj = new Date(dateObj);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    const url = generateShareUrl(type);
    const shareData = {
        title: `Wishlist: ${currentList.name}`,
        text: `Check out this wishlist!`,
        url: url
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            // Fallback to copy link
            copyShareLink(type);
        });
    } else {
        // Fallback to copy link
        copyShareLink(type);
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
    const eventDate = document.getElementById('editListDate').value;
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
        document.getElementById('listName').textContent = name;
        document.getElementById('listDescription').textContent = description || 'No description';
        document.getElementById('listDate').textContent = eventDate ? `Event date: ${eventDate}` : '';
    })
    .catch(error => {
        console.error('Error updating list:', error);
        showToast(`Error updating list: ${error.message}`, 'error');
    });
}

function copyShareLink(type) {
    const url = generateShareUrl(type);
    copyToClipboard(url);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Copied to clipboard!', 'success');
        })
        .catch(err => {
            showToast('Failed to copy text', 'error');
        });
}

function generateShareUrl(type) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?list=${currentListId}&role=${type}`;
}

function generateQRCode(type) {
    const url = generateShareUrl(type);
    const canvas = document.getElementById('qrCanvas');
    const container = document.getElementById('qrCodeContainer');
    
    try {
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
             } catch (error) {
                 console.error("Error generating QR code:", error);
                 showFallbackQRCode(url, container, canvas);
             }
        } else {
            showFallbackQRCode(url, container, canvas);
        }
    } catch (error) {
        console.error('QR Code generation error:', error);
        showFallbackQRCode(url, container, canvas);
    }
}

function showFallbackQRCode(url, container, canvas) {
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
        <div class="share-url">${url}</div>
        <button class="btn btn-primary" onclick="copyToClipboard('${url}')">Copy URL</button>
    `;
    
    // Show the container
    container.classList.remove('hidden');
}

function emailShareLink(type) {
    const url = generateShareUrl(type);
    const subject = encodeURIComponent(`Check out this wishlist: ${currentList.name}`);
    const body = encodeURIComponent(`I'd like to share this wishlist with you:\n\n${url}`);
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateObj) {
    if (!dateObj) return 'Not available';
    
    // Handle Firebase Timestamp objects
    if (dateObj.toDate && typeof dateObj.toDate === 'function') {
        dateObj = dateObj.toDate();
    } else if (!(dateObj instanceof Date)) {
        // Try to convert to Date if it's not already a Date object
        dateObj = new Date(dateObj);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    const url = generateShareUrl(type);
    const shareData = {
        title: `Wishlist: ${currentList.name}`,
        text: `Check out this wishlist!`,
        url: url
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            // Fallback to copy link
            copyShareLink(type);
        });
    } else {
        // Fallback to copy link
        copyShareLink(type);
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