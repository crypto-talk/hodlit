# Business Impact Patterns — Enterprise Java

Read this file when reviewing code that handles payments, orders, inventory, user accounts,
notifications, financial calculations, or any domain where a logic error has real monetary
or compliance consequences.

---

## Table of Contents
1. Payment & Financial Logic
2. Order Management
3. Inventory & Stock
4. User & Account Management
5. Notification & Communication
6. Audit & Compliance
7. Idempotency & Duplicate Processing
8. Data Migration & Backward Compatibility

---

## 1. Payment & Financial Logic

### Floating point for money
**Never** use `double` or `float` for monetary values. Use `BigDecimal` with explicit scale
and `RoundingMode`. A `0.1 + 0.2` float operation yields `0.30000000000000004`.

```java
// WRONG
double total = price * quantity;

// RIGHT
BigDecimal total = price.multiply(BigDecimal.valueOf(quantity))
                        .setScale(2, RoundingMode.HALF_UP);
```

### Rounding mode matters
`HALF_UP` vs `HALF_EVEN` (banker's rounding) — in regulated financial systems, the rounding
mode may be mandated. An incorrect rounding mode can cause penny discrepancies that accumulate.

### Currency mismatch
Ensure all monetary amounts in an operation use the same currency. Mixing USD and EUR without
conversion is a silent business failure.

### Tax/discount order of operations
Applying discounts then tax vs tax then discounts yields different results. The order must
match the business contract exactly. Flag if order of operations is unclear.

### Negative amounts
Can a price, quantity, or total ever be negative? If yes, is that intended (refund)?
If no, is there a validation guard?

---

## 2. Order Management

### State machine violations
Orders typically follow a state machine (PENDING → CONFIRMED → SHIPPED → DELIVERED → CANCELLED).
Any code that sets a status directly (without going through the machine) risks illegal transitions.
Look for direct `order.setStatus(CANCELLED)` calls that bypass transition guards.

### Double-processing on retry
If an order creation endpoint is retried (network timeout), a second order may be created.
Look for idempotency keys or unique constraints that prevent this.

### Partial failure on multi-step order
If an order creation involves: save order + reserve inventory + charge payment + send email,
and step 3 fails, is step 2 rolled back? Is the transaction boundary broad enough?

### Cancelled order still affecting inventory
If an order is cancelled, is the reserved inventory released? Look for missing `@PostUpdate`
or event listeners on status changes.

---

## 3. Inventory & Stock

### Race condition on stock decrement
Two concurrent requests check stock = 1, both see stock > 0, both decrement — stock goes to -1.
Fix: use optimistic locking (`@Version`) or a DB-level `UPDATE stock SET qty = qty - 1 WHERE qty > 0`.

### Overselling
Soft-reserved vs hard-reserved stock. If "available" stock is calculated as `total - softReserved`,
and soft reservations expire, the expiry job must run correctly or stock becomes permanently unavailable.

### Zero/negative stock alerting
Is there monitoring or an alert when stock hits zero? A silent out-of-stock with no notification
is a business failure.

---

## 4. User & Account Management

### Privilege escalation
When updating a user, can the caller elevate their own role? Check that `role` field is not
accepted from user input in update endpoints.

### Account enumeration
`"User not found"` vs `"Wrong password"` — different messages reveal whether an email exists.
Both should return the same generic message.

### Soft delete side effects
If users are soft-deleted (`active = false`), are queries properly filtered? A `findAll()`
that returns soft-deleted users can leak data or cause unexpected behavior in reports.

### Email change without verification
Allowing an email change without re-verification can be used for account takeover.

---

## 5. Notification & Communication

### Duplicate notifications
If a notification is sent inside a transaction and the transaction retries, the same notification
may be sent multiple times. Use outbox pattern or transactional messaging.

### Notification on failure paths
If the code sends an email/SMS in a finally block or catch block, a business failure may
trigger a confusing user notification ("Your order was placed!" when it was actually rolled back).

### PII in notification content
Are email bodies, SMS messages, or push notifications storing or logging PII that should
be minimal? Does the notification content expose data to the wrong person?

---

## 6. Audit & Compliance

### Missing audit trail
For financial, medical, or regulated operations, every create/update/delete should produce
an audit log entry. Look for `@EntityListeners(AuditingEntityListener.class)` or equivalent.

### Who made the change?
`createdBy` / `updatedBy` fields — are they populated from the security context or hardcoded?
`SecurityContextHolder.getContext().getAuthentication()` should be the source.

### Audit log integrity
Audit logs should be append-only. If the audit table allows UPDATE or DELETE, it's not a
real audit trail for compliance purposes.

---

## 7. Idempotency & Duplicate Processing

### Non-idempotent POST endpoints
If a POST endpoint creates a resource and is called twice (retry, double-click), two resources
are created. Idempotency can be achieved with:
- Unique constraint on a business key in the DB
- Idempotency key header checked before processing
- `findOrCreate` pattern

### Message consumer idempotency
Kafka/RabbitMQ consumers can receive the same message more than once (at-least-once delivery).
The consumer must be idempotent — processing the same message twice should produce the same result.
Look for checks like `if (alreadyProcessed(eventId)) return;`.

### Scheduled job re-entrancy
If a scheduled job processes a batch of records and fails halfway, will it re-process
already-processed records on next run? Look for a `processed` flag or cursor-based pagination.

---

## 8. Data Migration & Backward Compatibility

### Adding NOT NULL columns without default
Adding a `NOT NULL` column to a table with existing rows will fail unless a DEFAULT is provided
or the migration populates existing rows first. An entity field added without a corresponding migration
will cause `DataIntegrityViolationException` at runtime.

### Renaming a column in production
If code is deployed in phases (old code still running while new code deploys), a renamed column
will break the old code. Use additive migrations: add new column, dual-write, migrate, remove old.

### Enum value additions
Adding a new enum value is safe for new records. But if old code reads a row with the new enum
value, it will throw a deserialization error. Ensure backward compatibility before deploying.

### Removing a field from a DTO/API response
Callers relying on the removed field will silently get `null` (JSON) or break entirely.
Never remove fields from a versioned public API without a deprecation cycle.

### Hibernate schema validation
`spring.jpa.hibernate.ddl-auto=validate` will fail startup if entity and schema are out of sync.
`none` will silently allow mismatches that fail at query time. Check which is configured.
