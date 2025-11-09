# Wisher - Wishlist Manager

A modern, feature-rich wishlist application built with HTML, CSS, JavaScript, and Firebase. Create, share, and manage wishlists with features like drag-and-drop reordering, collaborative editing, and sharing.

## Features

### Core Functionality
-  **Firebase Authentication** - Google OAuth and email/password sign-in
-  **Real-time Database** - Firestore backend with security rules
-  **Material Design UI** - Clean, modern interface with light blue theme
-  **Responsive Design** - Works on desktop, tablet, and mobile devices

### List Management
-  **Multiple Lists** - Create and manage multiple wishlists
-  **Collaborative Editing** - Share lists with collaborators who can edit
-  **Viewer Access** - Share read-only access with viewers
-  **List Settings** - Manage list name, description, and event dates

### Item Features
-  **Rich Item Details** - Name, description, URL, image, price, and notes
-  **Markdown Support** - Rich text formatting in notes
-  **Drag & Drop Reordering** - Intuitive item positioning
-  **Quick Jump** - Navigate to specific item positions
-  **Purchase Tracking** - Mark items as bought with buyer information
-  **Image Support** - Display product images

### Sharing & Collaboration
-  **Multiple Share Options** - Links, QR codes, and email sharing
-  **Role-based Access** - Owner, collaborator, and viewer permissions
-  **Native Mobile Sharing** - Platform-specific share menus
-  **URL-based Access** - Direct links to specific lists and items

### Advanced Features
-  **Show/Hide Bought Items** - Toggle visibility of purchased items
-  **Buyer Information** - Track who bought what with contact details
-  **Comments System** - Allow viewers to comment on items
-  **Gemini AI Integration** - Auto-summarize web pages (API key required)
-  **Offline Support** - Local storage for quick access


## Usage Guide

### Creating Your First List

1. Sign in with Google or create an account
2. Click "Create New List"
3. Enter list name, event date, and description
4. Start adding items with the "Add Item" button

### Adding Items

1. Click "Add Item" in your list
2. Fill in item details:
   - **Name** (required)
   - **URL** (product link or mailto:)
   - **Description** (brief overview)
   - **Image URL** (product photo)
   - **Notes** (supports markdown formatting)
   - **Price** (optional)
   - **Position** (for ordering)

### Sharing Lists

1. Click the share button in the app bar
2. Choose sharing method:
   - **Viewer**: Read-only access
   - **Collaborator**: Can edit and add items
3. Share via:
   - Copy link
   - QR code
   - Email
   - Native mobile sharing

### Managing Purchases

1. Click the shopping cart icon on any item
2. Enter buyer information (name, email, note)
3. Item will be marked as bought
4. Use the "Show bought items" toggle to view/hide purchased items

### Reordering Items

- **Drag & Drop**: Drag items by the handle icon
- **Quick Jump**: Enter position number to jump to specific items
- **URL Fragments**: Use `#15` in URL to jump to item 15

## Security Features

- **Firebase Security Rules** ensure data protection
- **Role-based Access Control** (Owner, Collaborator, Viewer)
- **Email-based Permissions** for secure sharing
- **Secure Authentication** with Firebase Auth
- **No API Keys in Frontend** (except optional Gemini key)

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

This is a complete, production-ready application. Feel free to:

1. Fork the repository
2. Add new features
3. Submit pull requests
4. Report issues

## Support

For issues or questions:

- Check the browser console for error messages
- Check network connectivity

## Roadmap

Potential future enhancements:

- [x] Amazon wishlist import functionality
- [ ] Gift receipt storage system
- [ ] Advanced tagging and filtering
- [ ] Email notifications for purchases
- [ ] Mobile app versions
- [x] Bulk item import
- [ ] Advanced analytics and insights
- [ ] Offline-first functionality
