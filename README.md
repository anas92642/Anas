## No-login guest mode (latest update)
- The old User Register/Login system is gone from the public site. The
  site now opens directly to the content list — every visitor sees the
  rate/price under each item immediately, no login wall.
- **Tap any item** → its description pops up in a small card. Nothing is
  required just to look.
- **Buy a 🔒 Premium item** → a small popup asks for just **Name +
  Phone Number** (no password, no photo, one time per device — it's
  remembered after that), then shows the JazzCash payment details +
  screenshot upload, exactly like before. Admin approves it from
  **Premium_Requests.log** the same way; once approved it stays
  unlocked for that visitor's device.
- **Live Chat (💬 bottom-left)** → asks only for a **Name**, then opens
  straight into the chat with Admin. Admin sees and replies to every
  conversation from the dashboard's Live Chat section, same as before.
- The **⚙ Admin** button (top-left of the guest page) still opens the
  Admin password login — that part is unchanged and is now the *only*
  login on the site. The old Moderator/Register/Login system still
  exists in the code (harmless, just hidden) in case you ever want to
  re-enable accounts later.
- Note: if you connect Cloud Sync (Firebase) for multi-device sync,
  Admin discovering a brand-new guest's chat thread from a *different*
  device in real time still needs Admin to open/see that guest at
  least once (same as the existing per-thread subscription model) —
  messages themselves always sync correctly either way.

# Anas Technical World — File Structure

```
index.html          -> page structure only
style.css            -> all styling / animations / theme / background photo
script.js             -> all core logic (login, uploads, chat, voice assistant, backup)
firebase-sync.js      -> OPTIONAL cloud sync layer (see below) — loads after script.js
assets/
  hero-arms-crossed.png
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

## Uploads &amp; Links now show as "app icons"
- When Admin uploads a file, a **name box appears first** — type what the
  file/app is (e.g. "WhatsApp", "PDF Notes"), then click "+ Upload File".
  That name is what shows under the icon everywhere on the site (users
  and admin both see the same rounded app-icon tile + name, like a
  phone home-screen).
- Links already worked the same way — add a name + URL and an icon is
  auto-generated (site favicon, or a colored letter tile if no favicon
  is found).
- If a Gemini API key is saved (Settings → Gemini AI Assistant), every
  new link also gets a short AI-written one-line description under its
  name automatically. Without a key, links still work fine — they just
  won't have the AI description.

## Moderator role
- Admin can promote any already-registered (approved) user to
  **Moderator** from the Users list — "🛡 Make Moderator" button.
- A Moderator logs in through the exact same **User → Login** box as
  everyone else, using the account's own phone + password. The site
  detects the Moderator role and sends them to a separate panel
  automatically.
- The Moderator panel shows: pending registration requests (Accept /
  Reject — disappears immediately from both their list and Admin's),
  the same **Admin Updates** (published files) and **Admin Links**
  that regular users see, and their own **My Uploads** area where a
  Moderator can upload a file or add a link.
- **Anything a Moderator uploads or adds always goes to Admin for
  approval first** — it is not visible to users until Admin approves
  it. Admin sees these under **// Moderator_Submissions.log** on the
  Admin dashboard, with Approve / Reject buttons. Approving an upload
  moves it into the normal admin uploads list (Admin still clicks
  Publish); approving a link makes it go live immediately. Rejecting
  either deletes it and notifies the Moderator. A Moderator can see the
  live status of everything they've submitted at the bottom of their
  own panel.
- Admin's own dashboard is unchanged and still sees everything (total
  users, uploads, chat, settings, etc.) exactly as before.

## Uploads &amp; links: description, auto-links, and custom/AI icons
- Both the Admin's and Moderator's upload/link forms now have an
  optional **description** box. Any URL typed inside it (with or
  without "https://") is automatically turned into a clickable link
  wherever that description is shown — no manual link-tag needed.
- Both forms also have an optional **"🖼 Icon Picture"** button — attach
  your own picture and it's used as that item's icon everywhere.
- If no picture is attached, and a Gemini API key is saved (Settings →
  Gemini AI Assistant), the site automatically asks Gemini to generate
  a simple icon/logo for that upload/link based on its name, with a
  small "Anas Technical World" watermark baked in. Without a key (or if
  the request fails), the existing colored letter-tile icon is used
  instead — it now always carries a small "ATW" badge in the corner so
  every auto-generated icon stays branded either way.
- Admin can now **Edit** any upload or link (name, description, and —
  for links — the URL) from the "Edit" button on its tile/card.

## Premium content (pay-to-unlock)
- Both the Admin upload form and the Admin link form now have a
  **"🔒 Premium"** checkbox. Ticking it marks that file/link as
  Premium — it also shows a small 🔒 badge on its icon and a "🔒
  Premium" tag under its name everywhere it appears.
- **Files and links now show together in one combined list** ("//
  Admin Content" for users, "// Content_Control.log" for Admin) —
  there's no separate "these are links" section anymore, exactly
  like a phone home-screen of icons.
- When a user (or Moderator) taps a Premium item, instead of opening
  it they see a payment screen: fee **Rs 100**, JazzCash number
  **03074499097**, name **Muhammad Anas Ishaq**, and an upload
  button for their payment screenshot.
- Once they upload a screenshot, it goes to Admin's new **"//
  Premium_Requests.log"** section (Admin dashboard) with **Accept /
  Reject** buttons and a tap-to-enlarge screenshot preview.
- If Admin **Accepts**, that Premium item unlocks permanently for
  that exact user — from then on it opens directly, every time, no
  re-payment needed. If Admin **Rejects**, the user is notified and
  can try again with a corrected screenshot.
- **Admin always bypasses the lock** — Premium items always open
  directly for Admin, so Admin can still preview/manage them.
- Admin can flip an item's Premium status on/off anytime from its
  "🔒 Premium / 🔓 Unlock" button in the Content_Control list.
- This syncs across devices the same way uploads/links do, once
  Cloud Sync (Firebase) is connected (see below) — a new
  `premiumRequests` collection carries the payment screenshots and
  their Accept/Reject status.

## 3D / 4K Technical Theme
- `theme-3d.css` and `theme-3d.js` (loaded after `style.css`/`script.js`)
  add a glass/neon "4K technical" look on top of the existing design:
  frosted-glass panels, glowing neon borders, 3D-tilt app icons, and an
  animated particle-network canvas background that reacts to your mouse.
- Nothing was renamed or removed, so this is purely visual — all
  existing logic keeps working exactly as before.

## Per-item Premium pricing
- Premium is no longer a single fixed Rs 100 for everything. Both the
  Admin upload form and the Admin link form now have a **Price (Rs)**
  box next to the "🔒 Premium" checkbox — set whatever price you like
  per file/link.
- Already-published items: click the **🔒/🔓 Premium** button to
  toggle Premium on (it'll ask you for the price), or the **💰 Rs …**
  button on an already-Premium item to change its price anytime.
- The payment screen a user sees now shows that specific item's price,
  JazzCash number, and name.

## Description shown only when tapped
- The public content grid (both for Users and Moderators) now shows
  **only the name** under each icon — exactly like a phone home-screen.
- Tapping an item opens a small popup showing its description (if
  Admin wrote one) plus an **Open** button that actually opens the
  file/link. Items with no description just show the name + Open
  button. Premium items still go through the payment/approval flow
  first, and now also show the description there.

## Automatic notifications when someone joins, and on premium payments
- The moment anyone registers on the site, Admin now gets **(1)** an
  in-website notification (the 🔔 bell, and the toast area) **and**
  **(2)** an email — this fires immediately, whether or not Cloud Sync
  (Firebase) is connected.
- The moment a user uploads a premium payment screenshot, Admin gets
  the same: an in-website notification **and** an email.
- All emails go to **anas92642@gmail.com**.
- **Setup required (one-time, free):** since this is a static site,
  sending real email needs an email-sending service — this uses
  [EmailJS](https://www.emailjs.com):
  1. Create a free EmailJS account → **Email Services** → connect your
     Gmail (or any provider) → note the **Service ID**.
  2. **Email Templates** → create a template with variables
     `{{to_email}}`, `{{subject}}`, `{{message}}`, `{{site_name}}` in
     the body (e.g. subject field = `{{subject}}`, body = `{{message}}`)
     → note the **Template ID**.
  3. **Account → General** → copy your **Public Key**.
  4. On the site: log in as Admin → **Settings → Email Notifications
     (to anas92642@gmail.com)** → paste the Service ID, Template ID,
     and Public Key → **Save Email Settings** → click **Send Test
     Email** to confirm it works.
  - Until this is configured, the website notifications (bell/log)
    still work instantly on their own — only the email part needs the
    EmailJS keys.


The admin's "Gemini AI Assistant" panel calls Google's Gemini API directly
from the browser using an API key the admin enters (get one free at
https://aistudio.google.com/apikey). The key is stored only in that
browser's localStorage and sent straight to Google. The AI Stand-In feature
above reuses this same key if you've set one.
