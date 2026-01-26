<p align="center">

![Last Commit](https://img.shields.io/github/last-commit/fluffy-bunny-23/wisher)
![License](https://img.shields.io/badge/License-CC--BY--NC--SA%204.0-lightgrey.svg)
![Top Language](https://img.shields.io/github/languages/top/fluffy-bunny-23/wisher)
![Repo Size](https://img.shields.io/github/repo-size/fluffy-bunny-23/wisher)
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/Fluffy-Bunny-23/Wisher)

</p>

# Wisher - Wishlist Manager

A modern, feature-rich wishlist application built with HTML, CSS, JavaScript, and Firebase. Create, share, and manage wishlists with features like drag-and-drop reordering, collaborative editing, and sharing.

## Features

### Core Functionality
-  **Firebase Authentication** - Google OAuth and email/password sign-in
-  **Real-time Database** - Firestore backend with security rules
-  **Material Design  Based UI** - Clean, modern interface with light blue theme

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

Feel free to:

1. Fork the repository
2. Add new features
3. Submit pull requests
4. Report issues
   
I will try my best to merge PRs and look at issues, and try to fix them, but nobody is perfect, and I have a lot of things to do.

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
