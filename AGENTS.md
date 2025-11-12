# AGENTS.md - Development Guidelines for Wisher

## Build & Development Commands

### Local Development

- NEVER start a server without asking user first - one is likely already running
- If server needed: `python server.py [port]` (default port 8000, sometimes run at port 7050) - ASK USER FIRST
- `firebase serve` - Alternative Firebase local server
- `firebase deploy` - Deploy to production
- `firebase hosting:channel:deploy <channel>` - Deploy to preview channel

### Testing

- No automated test framework configured
- Manual testing via browser at <http://localhost:8000>
- Test Firebase integration with real Firebase project

## Code Style Guidelines

### JavaScript (app.js)

- Use ES6+ features (const/let, arrow functions, async/await)
- Global variables at top with descriptive names
- Function naming: camelCase with descriptive verbs (showSyncIndicator, hideSyncIndicator)
- Error handling with try/catch blocks and user feedback
- Firebase SDK compatibility mode (firebase-app-compat, firebase-auth-compat, firebase-firestore-compat)

### CSS (styles.css)

- Material Design principles with CSS custom properties
- BEM-style class naming where applicable
- Mobile-first responsive design
- CSS custom properties for theming (--primary-color, --surface-color, etc.)

### HTML Structure

- Semantic HTML5 elements
- Material Icons for UI elements
- External CDN libraries with version pinning
- Progressive enhancement approach

### Firebase Integration

- Use Firestore for data persistence
- Firebase Auth for authentication (Google OAuth, email/password)
- Security rules for data protection
- No API keys in frontend code (except optional Gemini key)

### General Conventions

- File naming: kebab-case for assets, camelCase for JS
- Comments only for complex business logic
- localStorage for client-side preferences
- Material Design UI components throughout
