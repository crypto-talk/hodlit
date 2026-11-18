# Service administrator permissions

`members.role` is the source of service-wide admin authorization. Values are `USER` and `ADMIN`. Migration 016 defaults existing and new members to `USER`. Explicitly provision approved administrators after deployment. The old environment allowlist is no longer used; no account is automatically promoted.

Find the intended account and grant using its unique ID:

```sql
SELECT id, login_id, nickname, role FROM members WHERE login_id = 'user@example.com';
UPDATE members SET role = 'ADMIN', updated_at = CURRENT_TIMESTAMP WHERE id = 42;
SELECT id, login_id, nickname, role FROM members WHERE id = 42;
```

Revoke with:

```sql
UPDATE members SET role = 'USER', updated_at = CURRENT_TIMESTAMP WHERE id = 42;
```

Each admin action queries the database using the validated JWT subject. Grants and revocations apply on the next request without restarting or renewing tokens. Account creation/profile APIs cannot write this field. Room management, community news and polls share this service-wide permission. There are no room-specific administrators.
