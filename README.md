![hardware pic](https://github.com/user-attachments/assets/6a6e0a97-4f72-4d6a-8736-983426b56470)

# PowerKnock
iot system for students to securely lock and unlock their room using rfid and knock pattern

POST /api/device/verify
        │
        ▼
[1] Fields present?          → NO  → 401
        │ YES
        ▼
[2] Types valid?             → NO  → 401
        │ YES
        ▼
[3] Device in DB?            → NO  → 401
        │ YES (fetches secretKey)
        ▼
[4] Timestamp < 30s old?     → NO  → 401
        │ YES
        ▼
[5] Rebuild message string
        │
        ▼
[6] Compute expected HMAC
        │
        ▼
[7] Signatures match?        → NO  → 401
        │ YES
        ▼
[8] Attach device to req → next()  → Controller
