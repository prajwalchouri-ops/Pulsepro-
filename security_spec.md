# PulsePro Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: All undefined paths under `/databases/{database}/documents` are rejected for read and write.
2. **Verified Identity Ownership**: All writes require `request.auth != null` AND `request.auth.token.email_verified == true`.
3. **PII Isolation (Split Collection)**: Public identity fields (`displayName`) live at `/users/{userId}` while email PII lives at `/users/{userId}/private/{docId}`, readable and writable strictly by the owning `userId`.
4. **Master Gate Relational Sync**: `/users/{userId}/bookings/{bookingId}` creation and updates require parent `/users/{userId}` document existence and `ownerId == request.auth.uid == userId`.
5. **Immutable Audit & Ownership Fields**: `ownerId` and `createdAt` cannot change after creation; `createdAt` and `updatedAt` must equal `request.time`.
6. **Terminal State Locking**: Once a booking reaches `Completed` or `Cancelled`, no client update may alter it.
7. **Strict Schema & Bounds**: Every string field enforces `.size() <= MAX`; `keys().hasAll(...) && keys().hasOnly(...)` blocks ghost/shadow fields on creation; `affectedKeys().hasOnly(...)` restricts every update action branch.
8. **Secure List Queries**: `allow list` rules explicitly evaluate `resource.data.ownerId == request.auth.uid` without `get()` or `exists()`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: Read `/users/userA/bookings/PP-8510` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Create `/users/userA` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant PII Theft**: UserB (`uid: userB`) reads `/users/userA/private/info` -> `PERMISSION_DENIED`.
4. **Shadow/Ghost Field Injection**: UserA creates `/users/userA` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Create**: UserB creates `/users/userA/bookings/PP-9999` with `ownerId: "userA"` -> `PERMISSION_DENIED`.
6. **Orphan Booking Without Parent User**: UserA creates `/users/userA/bookings/PP-9999` before `/users/userA` exists -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: UserA creates `/gameScores/sc1` with client-provided past `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
8. **ID Poisoning (Resource Exhaustion)**: UserA writes `/gameScores/<200-char-invalid-id!>` -> `PERMISSION_DENIED`.
9. **Value Poisoning / Oversized String**: UserA writes booking with 1000-character `notes` (`> 500`) -> `PERMISSION_DENIED`.
10. **Terminal State Resurrection**: UserA updates booking whose `status` is `'Completed'` back to `'Confirmed'` -> `PERMISSION_DENIED`.
11. **Multi-Field Unauthorized Update**: UserA updates both `totalAmount` and `status` in a single booking update -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: UserB runs `list` on `/gameScores` without filtering `ownerId == 'userB'` -> `PERMISSION_DENIED`.
