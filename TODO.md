# Task TODO — Admin Approval + User/Link Management + Remove Voice Assistant

## Step 1 — Registration requires Admin Approval
- [x] Plan approved
- [ ] Add `approved:false` on new registration; do NOT auto-login
- [ ] Show pending-approval success message, switch to login tab
- [ ] `userLogin` + `restoreSession` reject unapproved users
- [ ] Treat legacy users (no `approved` field) as approved

## Step 2 — Admin user management
- [ ] `renderUsersList` shows Pending badge + Approve button
- [ ] Add Delete button for all users
- [ ] Implement `approveUser(phone)` and `deleteUser(phone)`

## Step 3 — Admin messaging + message delete
- [ ] Give every message a `mid` id
- [ ] `renderAdminChatLog` shows a delete button per message
- [ ] Implement `adminDeleteMessage(phone, mid)`

## Step 4 — Admin link uploads with required name + AI icon
- [ ] Add Name input + Link/File upload controls in HTML
- [ ] Require name before any file upload
- [ ] Add `handleAdminLinkUpload`; auto-generate icon (favicon + initials)
- [ ] Render link icons in admin + community upload lists

## Step 5 — Remove Voice Assistant
- [ ] Remove mic button + assistant panel from HTML
- [ ] Remove voice/speech/command JS from script.js
- [ ] Remove related CSS and cleanup beginLogin/logout refs

## Step 6 — Cloud sync (firebase-sync.js)
- [ ] Sync approve/delete user
- [ ] Sync delete chat message (mid-based firewall-safe)
- [ ] Sync link uploads

## Step 7 — Docs + schema
- [ ] Update data/schema.json with new fields
- [ ] Update translations (ur/en)

## Step 8 — Test
- [ ] Full flow: register → pending → admin approve → login → block/unblock/delete → send & delete messages → link upload

