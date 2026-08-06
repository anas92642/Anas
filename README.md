# Anas Technical World — File Structure

```
index.html          -> page structure only
style.css            -> all styling / animations / theme
script.js             -> all logic (login, uploads, chat, Gemini AI, backup)
assets/
  hero-arms-crossed.png
  hero-adjusting-tie.png
data/
  schema.json         -> documents the data shape (see note below — NOT a live database)
```

## How to run it
Keep all files in the same folder structure shown above (don't move `style.css`,
`script.js`, or `assets/` to a different folder relative to `index.html`), then
either:
- Double-click `index.html` to open it in a browser, or
- Upload the whole folder to any web host (e.g. Hostinger, GitHub Pages,
  Netlify) — no build step, no server-side code required.

## About "the database"
There is no real backend database here — this is a static site (HTML/CSS/JS
only), so all data (registered users, their passwords, uploaded files, chat
messages, the admin password, the announcement) is saved in the visitor's
**browser localStorage**. `data/schema.json` documents the shape of that data
for reference; it is not read by the site at runtime.

What this means in practice:
- Data survives page reloads and re-uploading a new version of `index.html`,
  as long as it's the same browser on the same device.
- Data is **not shared** between different users' devices/browsers. Two
  people opening the site on their own phones will not see each other's
  chats, uploads, or registrations — each only sees what's on their own
  device.
- For a real multi-user, multi-device system (which a live "Admin sees every
  user's registration and chat" workflow really needs), add a backend
  database — Firebase (fastest to add, generous free tier) is the natural
  next step. Ask me if you'd like this added.

## Gemini AI panel
The admin's "Gemini AI Assistant" panel calls Google's Gemini API directly
from the browser using an API key the admin enters (get one free at
https://aistudio.google.com/apikey). The key is stored only in that
browser's localStorage and sent straight to Google — it is not sent
anywhere else. For a production deployment, route this through your own
backend so the key isn't exposed in client-side code.
