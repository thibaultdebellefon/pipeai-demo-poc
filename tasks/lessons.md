# Lessons Learned

## Task 3 - Camera Access & Video Preview
- **[2026-03-30]** | Confirmed `let mediaStream = null` must be declared at module scope (outside functions) to be reused by stopRecording in Task 4
- **[2026-03-30]** | Use `textContent` (not innerHTML) for security when setting error messages from user-facing errors
- **[2026-03-30]** | `facingMode: 'environment'` requests back camera; essential for plumbing/inspection use cases
- **[2026-03-30]** | Always check `err.name === 'NotAllowedError'` to distinguish user denial from hardware issues
