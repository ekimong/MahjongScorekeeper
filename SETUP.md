# Setup

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and create a new project
2. Enable **Authentication** → Sign-in methods → Email/Password and Google
3. Enable **Firestore Database** (start in production mode)
4. Go to Project Settings → Your apps → Add web app → copy the config

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the Firebase config values:

```
cp .env.example .env.local
```

Then paste your Firebase config values into `.env.local`.

## 3. Deploy Firestore security rules

Install the Firebase CLI if needed:
```
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project, use firestore.rules
firebase deploy --only firestore:rules
```

## 4. Create Firestore indexes

The app needs one composite index. In the Firebase Console → Firestore → Indexes, add:

| Collection | Fields | Order |
|-----------|--------|-------|
| `events` | `createdBy` ASC, `createdAt` DESC | — |
| `history` | `uid` ASC, `playedAt` DESC | — |

## 5. Run locally

```
npm install
npm run dev
```

## 6. Deploy to Firebase Hosting (optional)

```
firebase init hosting   # dist folder, SPA rewrite
npm run build
firebase deploy --only hosting
```
