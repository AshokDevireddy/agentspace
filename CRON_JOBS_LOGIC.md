# Cron Jobs Logic - Complete Breakdown

## Overview
All cron jobs now create **draft messages** instead of sending immediately. They all follow similar patterns but have different filtering logic.

---

## 1. Billing Reminders Cron Job
**File:** `src/app/api/cron/billing-reminders/route.ts`
**Runs:** Daily at 8 AM
**Purpose:** Remind clients about upcoming premium payments

### RPC Function: `get_billing_reminder_deals()`
**File:** `migrations/add_cron_job_rpc_functions.sql`

This cron uses an RPC function that properly checks deal status using the `status_mapping` table.

### Status Checking (IMPORTANT):
❌ **OLD (WRONG):** `WHERE status = 'active'`
✅ **NEW (CORRECT):** Uses `status_mapping` table with case-insensitive match on `raw_status` and checks `impact = 'positive'`

The RPC function:
1. Joins deals with `status_mapping` on `carrier_id` and case-insensitive `raw_status`
2. Filters for `impact = 'positive'` (these are active deals)
3. This is critical because `deals.status` has many different values depending on the carrier

### Fields Used:
| Table | Field | Purpose |
|-------|-------|---------|
| `deals` | `status` | Matched with status_mapping.raw_status (case-insensitive) |
| `status_mapping` | `impact` | Must be `'positive'` to be considered active |
| `deals` | `client_phone` | Must NOT be null |
| `deals` | `billing_cycle` | Must NOT be null (values: 'monthly', 'quarterly', 'semi-annually', 'annually') |
| `deals` | `policy_effective_date` | Must NOT be null, used to calculate next billing date |
| `deals` | `client_name` | Used in message personalization |
| `users` (agent) | `id, first_name, last_name, agency_id` | Agent info |
| `agencies` | `phone_number` | Used as SMS sender |
| `agencies` | `messaging_enabled` | Must be true to send |

### Logic Flow:
1. **Call RPC function** `get_billing_reminder_deals()`
   - RPC calculates next billing date for each deal
   - RPC filters deals where:
     - Next billing date is **exactly 3 days from today** OR
     - **Policy effective date is exactly 3 days from today** (FIXED - now sends reminders 3 days before effective date too!)
   - Only returns deals with `impact = 'positive'` from status_mapping
2. For each returned deal:
   - Get/create conversation
   - Check if client opted in (`sms_opt_in_status = 'opted_in'`)
   - Create draft message with status='draft'

### FIXED: Now Also Sends 3 Days Before Effective Date
✅ **NEW:** The cron now sends reminders for:
1. **Recurring billing dates** (e.g., monthly anniversaries)
2. **Initial policy effective date** (3 days before the policy starts)

**Example:**
- Today: January 15, 2025
- Deal effective date: January 18, 2025 (3 days from now)
- Result: ✅ **WILL SEND** reminder for upcoming effective date!

### FIXED: Effective Date Guard (Feb 2026)
Billing reminders are now blocked for calculated billing dates that fall before the policy effective date. This prevents premature reminders for deals that haven't started yet.

**The fix is applied at 3 layers:**
1. **SQL RPC** (`get_billing_reminder_deals_v2`): WHERE clause requires `calculated_next_billing_date >= policy_effective_date`
2. **TypeScript utility** (`calculateNextCustomBillingDate`): Accepts optional `effectiveDate` param and advances the billing date past the effective date
3. **TypeScript cron** (`billing-reminders/route.ts`): Passes `policy_effective_date` to the utility and verifies the result matches 3-days-from-now before sending

**Example of the bug this fixes:**
- Deal: SSN benefit, pattern = "2nd Wednesday", effective date = March 11, 2026
- Today: Feb 8 → next "2nd Wednesday" = Feb 11 → 3 days from now matches
- ❌ **OLD:** Billing reminder sent on Feb 8 for a policy that hasn't started
- ✅ **NEW:** `calculateNextCustomBillingDate("2nd", "Wednesday", "2026-03-11")` → March 11 (skips Feb 11 since it's before effective date). No match, no reminder.

### To Test Billing Reminders:
**Option 1:** Set effective date 3 days in the FUTURE
```sql
-- Will trigger reminder for initial policy effective date
UPDATE deals SET policy_effective_date = CURRENT_DATE + interval '3 days';
```

**Option 2:** Set effective date in the PAST for recurring reminders
```
Effective Date: December 13, 2024 (monthly cycle)
Next billing: January 13, 2025
If today is January 10, 2025: ✅ Will send (3 days away)
```

---

## 2. Birthday Messages Cron Job
**File:** `src/app/api/cron/birthday-messages/route.ts`
**Runs:** Daily at 9 AM (EST or PST based on config)
**Purpose:** Send birthday wishes to clients

### RPC Function: `get_birthday_message_deals()`
**File:** `migrations/add_cron_job_rpc_functions.sql`

This cron uses an RPC function that properly checks deal status using the `status_mapping` table.

### Status Checking (IMPORTANT):
❌ **OLD (WRONG):** `WHERE status = 'active'`
✅ **NEW (CORRECT):** Uses `status_mapping` table with case-insensitive match on `raw_status` and checks `impact = 'positive'`

### Fields Used:
| Table | Field | Purpose |
|-------|-------|---------|
| `deals` | `status` | Matched with status_mapping.raw_status (case-insensitive) |
| `status_mapping` | `impact` | Must be `'positive'` to be considered active |
| `deals` | `client_phone` | Must NOT be null |
| `deals` | `date_of_birth` | Must NOT be null (DATE type) |
| `deals` | `client_name` | Used in message |
| `users` (agent) | Agent info |
| `agencies` | `phone_number, messaging_enabled` | Agency settings |

### Logic Flow:
1. **Call RPC function** `get_birthday_message_deals()`
   - RPC extracts month and day from date_of_birth
   - Compares to today's month and day
   - Only returns deals with `impact = 'positive'` from status_mapping
2. For each returned deal:
   - Get/create conversation
   - Check opt-in status
   - Create draft message

### To Test Birthday Messages:
```sql
-- Update a deal's date_of_birth to today's date (any year)
UPDATE deals
SET date_of_birth = '1990-01-15'  -- Use today's month/day
WHERE id = 'your-deal-id';
```

---

## 3. Lapse Reminders Cron Job
**File:** `src/app/api/cron/lapse-reminders/route.ts`
**Runs:** Every 2 hours
**Purpose:** Notify clients about policies pending lapse

### RPC Function: `get_lapse_reminder_deals()`
**File:** `migrations/add_cron_job_rpc_functions.sql`

This cron uses an RPC function for consistency with other cron jobs.

### Fields Used:
| Table | Field | Purpose |
|-------|-------|---------|
| `deals` | `status_standardized` | Must be `'lapse_pending'` |
| `deals` | `client_phone` | Must NOT be null |
| `deals` | `client_name` | Used in message |
| `users` (agent) | `phone_number` | Included in message |
| `agencies` | `phone_number, messaging_enabled` | Agency settings |

### Logic Flow:
1. **Call RPC function** `get_lapse_reminder_deals()`
   - RPC filters for `status_standardized = 'lapse_pending'`
   - Only returns deals with messaging enabled
2. For each returned deal:
   - Get/create conversation
   - Check opt-in status
   - Create draft message
   - **⚠️ IMPORTANT:** Update `status_standardized` to `'lapse_notified'`
     - This happens even though message is draft!
     - Status change is immediate, SMS sending is deferred

### To Test Lapse Reminders:
```sql
-- Set a deal to lapse_pending
UPDATE deals
SET status_standardized = 'lapse_pending'
WHERE id = 'your-deal-id';

-- After cron runs, it will be:
-- status_standardized = 'lapse_notified' (even though message is draft)
```

---

## 4. Needs More Info Notifications
**File:** `src/app/api/cron/needs-more-info-notifications/route.ts`
**Runs:** Periodically
**Purpose:** Mark deals that need more info

### Supabase Query (Lines 27-31)
```sql
SELECT id, status_standardized
FROM deals
WHERE status_standardized = 'needs_more_info'
```

### Logic Flow:
1. **Query deals** with `status_standardized = 'needs_more_info'`
2. For each deal:
   - Update `status_standardized` to `'needs_more_info_notified'`
   - **NO SMS SENT** - This is just a status marker
   - Agents see these in UI as notifications

### Note:
This cron does NOT send SMS messages at all. It only updates statuses.

---

## Common Fields Across All Cron Jobs

### Required in `deals` table:
- `status` - Matched with `status_mapping.raw_status` (case-insensitive)
- `carrier_id` - Used to join with `status_mapping`
- `status_standardized` (for lapse reminders) - Filter condition
- `client_phone` - Must exist to send SMS
- `client_name` - Used in message personalization
- `agent_id` - FK to users table

### Required in `status_mapping` table:
- `carrier_id` - FK to deals table
- `raw_status` - Matched with deals.status (case-insensitive)
- `impact` - Must be 'positive' for active deals (billing & birthday)

### Required in `users` table (agents):
- `id, first_name, last_name` - Agent identification
- `agency_id` - FK to agencies table
- `phone_number` (for lapse reminders) - Agent contact

### Required in `agencies` table:
- `phone_number` - Used as SMS sender number
- `messaging_enabled` - Must be true to send
- `name` - Used in messages

### Required in `conversations` table:
- `sms_opt_in_status` - Must be 'opted_in' to send
- Created automatically if doesn't exist

## CRITICAL CHANGES - Status Checking

### ❌ OLD APPROACH (WRONG):
All cron jobs used to check `WHERE status = 'active'`, which was incorrect because:
- The `deals.status` field contains carrier-specific values
- Different carriers use different status names
- Simply checking for 'active' misses many active deals

### ✅ NEW APPROACH (CORRECT):
All cron jobs now use RPC functions that:
1. Join `deals` with `status_mapping` table
2. Match `deals.carrier_id = status_mapping.carrier_id`
3. Match `LOWER(deals.status) = LOWER(status_mapping.raw_status)` (case-insensitive)
4. Filter for `status_mapping.impact = 'positive'` (these are active deals)

This approach is already used successfully in other parts of the codebase (e.g., scoreboard, dashboard).

---

## Testing Each Cron Job

### 1. Test Billing Reminders
```sql
-- Set up a deal that will trigger
UPDATE deals
SET
  status = 'active',
  client_phone = '5551234567',
  billing_cycle = 'monthly',
  policy_effective_date = NOW() - INTERVAL '3 days' - INTERVAL '1 month'
  -- This makes next billing = today + 3 days
WHERE id = 'test-deal-id';

-- Ensure agency has messaging enabled
UPDATE agencies
SET messaging_enabled = true
WHERE id = 'agency-id';

-- Ensure conversation exists and is opted in
INSERT INTO conversations (agent_id, deal_id, client_phone, sms_opt_in_status)
VALUES ('agent-id', 'test-deal-id', '5551234567', 'opted_in')
ON CONFLICT DO NOTHING;
```

### 2. Test Birthday Messages
```sql
UPDATE deals
SET
  status = 'active',
  client_phone = '5551234567',
  date_of_birth = '1990-' || TO_CHAR(NOW(), 'MM-DD')
  -- Sets birthday to today (any year)
WHERE id = 'test-deal-id';
```

### 3. Test Lapse Reminders
```sql
UPDATE deals
SET
  status_standardized = 'lapse_pending',
  client_phone = '5551234567'
WHERE id = 'test-deal-id';
```

### 4. Call the Cron Endpoints
```bash
# Billing reminders
curl -X GET http://localhost:3002/api/cron/billing-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Birthday messages
curl -X GET http://localhost:3002/api/cron/birthday-messages \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Lapse reminders
curl -X GET http://localhost:3002/api/cron/lapse-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Debugging Checklist

When a cron job doesn't create drafts, check:

### 1. Deal Fields
- [ ] `status = 'active'` (or `status_standardized` for lapse)
- [ ] `client_phone IS NOT NULL`
- [ ] Specific field exists (billing_cycle, date_of_birth, etc.)

### 2. Agency
- [ ] `messaging_enabled = true`
- [ ] `phone_number IS NOT NULL`

### 3. Conversation
- [ ] Conversation exists or can be created
- [ ] `sms_opt_in_status = 'opted_in'`

### 4. Date/Time Logic
- [ ] **Billing:** Next billing date is exactly 3 days from today
- [ ] **Birthday:** Month/day matches today in PST
- [ ] **Lapse:** status_standardized = 'lapse_pending'

### 5. Check Logs
The cron jobs are very verbose. Look for:
```
📊 Found X active deals to check
📋 ClientName: Next billing 2025-01-18 ✅ DUE IN 3 DAYS
📬 Processing: ClientName
💾 Draft message created successfully!
```

---

## SQL Queries to Debug

### Check if deal matches billing reminder criteria:
```sql
SELECT
  d.id,
  d.client_name,
  d.status,
  d.client_phone,
  d.billing_cycle,
  d.policy_effective_date,
  a.messaging_enabled,
  a.phone_number as agency_phone,
  c.sms_opt_in_status
FROM deals d
LEFT JOIN users u ON d.agent_id = u.id
LEFT JOIN agencies a ON u.agency_id = a.id
LEFT JOIN conversations c ON c.deal_id = d.id
WHERE d.id = 'your-deal-id';
```

### Check next billing calculation:
```sql
-- For a monthly policy effective Dec 12, 2024
-- Next billing would be Jan 12, 2025 (from Dec 12)
-- Then Feb 12, 2025 (from Jan 12)
-- Reminder sends when next billing = today + 3 days

-- So if today is Jan 9, 2025:
-- Next billing = Jan 12, 2025
-- Today + 3 days = Jan 12, 2025
-- ✅ MATCH! Reminder will send
```

### Check for draft messages:
```sql
SELECT
  m.*,
  d.client_name,
  m.metadata->>'type' as message_type
FROM messages m
INNER JOIN conversations c ON m.conversation_id = c.id
INNER JOIN deals d ON c.deal_id = d.id
WHERE m.status = 'draft'
ORDER BY m.id DESC;
```
