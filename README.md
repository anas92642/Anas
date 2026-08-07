# Anas Technical World — File Structure

```
index.html          -> page structure only
style.css            -> all styling / animations / theme / background photo
script.js             -> all core logic (login, uploads, chat, voice assistant, backup)
firebase-sync.js      -> OPTIONAL cloud sync layer (see below) — loads after script.js
assets/
  hero-arms-crossed.png
  hero-adjusting-tie.png
data/
  schema.json         -> documents the data shape (reference only)
```

## How to run it
Keep all files in the same folder structure shown above, then:
- Upload the whole folder to any web host (Hostinger, GitHub Pages, Netlify,
  etc.) — no build step needed.
- **Important — voice assistant requires this:** open the site over
  `https://` (a real host) or `http://localhost`. If you just double-click
  `index.html` and open it as a `file://` link, Chrome/Edge will silently
  block microphone access and the mic will never work. This is a browser
  security rule, not a bug in the code.

## Voice Assistant
- Tap the mic, speak — it now keeps listening in a loop (a real back-and-forth
  conversation) until you say "stop listening" / "band karo" or tap the mic
  again.
- It can navigate/click anything on screen: "open uploads", "click publish",
  "kholo settings" — it searches the current screen for a matching
  button/link/heading and clicks it.
- It also handles normal small talk (greetings, "how are you", "who are
  you") in addition to the existing site commands (block/unblock, publish,
  announcement, accent color, etc).
- If the mic won't start, check: (1) the page is on https/localhost, not
  file://, (2) the browser's mic permission for the site is set to Allow.

## Cloud Sync (Firebase) — for real multi-device features
By default this is still a static site: without Firebase connected, all data
(users, uploads, chat, admin password, announcement) lives only in the
browser that's using it — two people on two devices won't see each other's
data. This is why "how many users are registered", "who's online", and
"admin sees every user's chat" can't work in local-only mode.

`firebase-sync.js` adds real multi-device sync, but it needs *your own* free
Firebase project (I can't create one on your behalf — it needs your Google
account):

1. Go to https://console.firebase.google.com → **Add project** (free).
2. In the project: **Build → Firestore Database → Create database** (start
   in test mode is fine to begin with).
3. **Build → Realtime Database → Create database** (needed for online/offline
   presence).
4. **Project settings (gear icon) → General → Your apps → Add app → Web**.
   Copy the config values shown (apiKey, authDomain, projectId, etc.) and
   the Realtime Database URL.
5. In the site: log in as Admin → **Settings → Cloud Sync (Firebase)** →
   paste those values in → **Connect Cloud Sync**.

Once connected, on every device:
- Registered users, uploads, and the announcement sync live for everyone.
- Admin sees every user's live chat messages, in real time.
- Admin dashboard shows accurate Online Now / Offline counts and pops up a
  toast when a new user logs in, with a "View Profile" button.
- Admin can block/unblock and reset any user's password from the Users list
  — changes sync everywhere.
- Settings → "AI Assistant Stand-In": when turned on, if the admin is
  offline, an AI (using your Gemini key if set, otherwise a friendly canned
  reply) answers incoming chat messages automatically, so the site is never
  unmanned.

**Note on Firestore security rules:** test mode allows open read/write for
30 days, which is fine while you're setting this up, but for a real
deployment go to Firestore → Rules and Realtime Database → Rules and lock
them down (e.g. so only your own site can write) before sharing the link
publicly.

## Gemini AI panel
The admin's "Gemini AI Assistant" panel calls Google's Gemini API directly
from the browser using an API key the admin enters (get one free at
https://aistudio.google.com/apikey). The key is stored only in that
browser's localStorage and sent straight to Google. The AI Stand-In feature
above reuses this same key if you've set one.
