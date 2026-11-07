-- M4.5.8.1: the four-column unique index's generated name is 65 bytes, past PostgreSQL's 63-byte
-- identifier limit, so the database stored a truncated name while the schema expected the full one —
-- permanent drift. The index keeps its columns and uniqueness and gains a short explicit name; no
-- row, column or counter changes. The old name here is the truncated form every fresh database gets
-- when 202611050001 creates the index.
ALTER INDEX "notification_deliveries_event_orderId_recipient_occurrenceKey_k" RENAME TO "notification_deliveries_event_order_recipient_occurrence_key";
