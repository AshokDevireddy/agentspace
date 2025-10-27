# SMS Testing Guide - Complete Flow Testing

## Overview
This guide walks through comprehensive testing of the entire SMS communication system using test data that covers all scenarios with your phone number: **6692456363**

## 📋 Prerequisites

1. **Database Migration Applied:**
   ```bash
   # Run this in Supabase SQL Editor
   sms_compliance_migration.sql
   ```

2. **Environment Variables Set:**
   - `TELNYX_API_KEY` - Your Telnyx API key
   - `CRON_SECRET` - Secret for cron job authentication

3. **Agency Phone Number Configured:**
   - Your agency must have a phone number in the database
   - This is the "from" number for all SMS messages

## 🧪 Setup Test Data

### Step 1: Load Test Data
```sql
-- Run in Supabase SQL Editor
-- This creates 10 test deals with 1 agent, all using your phone
\i seed_sms_test_data.sql
```

### Step 2: Verify Test Data Created
```sql
-- Check deals were created
SELECT
    client_name,
    policy_number,
    status_standardized,
    date_of_birth,
    policy_effective_date
FROM deals
WHERE policy_number LIKE 'SMS-%'
ORDER BY policy_number;

-- Check conversations were created
SELECT
    c.id,
    d.client_name,
    c.sms_opt_in_status,
    c.opted_in_at,
    c.opted_out_at
FROM conversations c
JOIN deals d ON c.deal_id = d.id
WHERE c.client_phone = '6692456363'
ORDER BY d.policy_number;
```

## 🎯 Test Scenarios

### Scenario 1: Birthday Reminders ✅

**Expected:** Receive 1 birthday message (Scenario 1 only)

```bash
# Run birthday cron job
curl -X GET "http://localhost:3000/api/cron/birthday-messages" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**What to Check:**
- ✅ Receive SMS for "Birthday Client (Opted In)"
- ❌ Do NOT receive for "Birthday Client (Opted Out)"
- ❌ Do NOT receive for "Pending Opt-in Client" (has birthday but not opted in)

**Expected Message:**
```
Happy Birthday, Birthday Client! Wishing you a great year ahead from your friends at [Agency Name].
```

**Verify in Database:**
```sql
-- Should show 1 birthday message sent
SELECT
    d.client_name,
    m.body,
    m.sent_at,
    c.sms_opt_in_status
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN deals d ON c.deal_id = d.id
WHERE m.metadata->>'type' = 'birthday'
ORDER BY m.sent_at DESC;
```

---

### Scenario 2: Billing Reminders ✅

**Expected:** Receive 1 billing reminder (Scenario 3 only)

```bash
# Run billing reminders cron job
curl -X GET "http://localhost:3000/api/cron/billing-reminders" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**What to Check:**
- ✅ Receive SMS for "Billing Due Client (Opted In)"
- ❌ Do NOT receive for "Billing Due Client (Opted Out)"

**Expected Message:**
```
Hi Billing Due, this is a friendly reminder that your insurance premium is due soon.
Please ensure funds are available for your scheduled payment. Thank you!
```

**Verify in Database:**
```sql
-- Should show 1 billing reminder sent
SELECT
    d.client_name,
    m.body,
    m.sent_at,
    c.sms_opt_in_status,
    m.metadata->>'next_billing_date' as next_billing_date
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN deals d ON c.deal_id = d.id
WHERE m.metadata->>'type' = 'billing_reminder'
ORDER BY m.sent_at DESC;
```

---

### Scenario 3: Lapse Reminders 🟡

**Expected:** Receive 1 lapse message, status updates to lapse_notified

```bash
# Run lapse reminders cron job
curl -X GET "http://localhost:3000/api/cron/lapse-reminders" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**What to Check:**
- ✅ Receive SMS for "Lapse Pending Client"
- ✅ Deal status changes from `lapse_pending` to `lapse_notified`
- ❌ Do NOT receive for "Lapse Notified Client" (already notified)

**Expected Message:**
```
Hi Lapse Pending Client, your life insurance policy is pending lapse.
Your agent SMS Test Agent will reach out soon.
If you'd like to speak with them now, call [agent phone].
```

**Verify Status Updated:**
```sql
-- Should show status changed to lapse_notified
SELECT
    client_name,
    policy_number,
    status_standardized,
    updated_at
FROM deals
WHERE policy_number IN ('SMS-LAPSE-PEND-001', 'SMS-LAPSE-NOT-001')
ORDER BY policy_number;

-- Expected:
-- SMS-LAPSE-PEND-001: lapse_notified (changed from lapse_pending)
-- SMS-LAPSE-NOT-001: lapse_notified (unchanged)
```

---

### Scenario 4: Needs More Info Notifications 🔵

**Expected:** No SMS sent, but status updates to needs_more_info_notified

```bash
# Run needs more info cron job
curl -X GET "http://localhost:3000/api/cron/needs-more-info-notifications" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**What to Check:**
- ❌ No SMS sent (this notification type doesn't send messages)
- ✅ Status changes from `needs_more_info` to `needs_more_info_notified`

**Verify Status Updated:**
```sql
-- Should show status changed to needs_more_info_notified
SELECT
    client_name,
    policy_number,
    status_standardized,
    updated_at
FROM deals
WHERE policy_number IN ('SMS-INFO-PEND-001', 'SMS-INFO-NOT-001')
ORDER BY policy_number;

-- Expected:
-- SMS-INFO-PEND-001: needs_more_info_notified (changed from needs_more_info)
-- SMS-INFO-NOT-001: needs_more_info_notified (unchanged)
```

---

### Scenario 5: UI Testing - Resolve Buttons 🔘

#### Test Lapse Notification (Yellow Banner)

1. **Navigate to SMS Page:**
   - Go to `/communications/sms`

2. **Find Conversation:**
   - Look for "Lapse Notified Client" or "Lapse Pending Client"
   - Click on the conversation

3. **Check Yellow Banner:**
   - Should see yellow notification alert
   - Text: "This policy is pending lapse. Client has been notified."
   - Resolve button should be visible

4. **Click Resolve:**
   - Click the "Resolve" button
   - Banner should disappear
   - Verify in database:
   ```sql
   SELECT status_standardized
   FROM deals
   WHERE client_name LIKE '%Lapse%Notified%';
   -- Should be NULL after resolving
   ```

#### Test Needs More Info (Blue Banner)

1. **Find Conversation:**
   - Look for "Needs Info Notified Client" or "Needs Info Client"

2. **Check Blue Banner:**
   - Should see blue notification alert
   - Text: "Additional information required for this policy."
   - Resolve button should be visible

3. **Click Resolve:**
   - Click the "Resolve" button
   - Banner should disappear
   - Verify in database:
   ```sql
   SELECT status_standardized
   FROM deals
   WHERE client_name LIKE '%Needs Info%Notified%';
   -- Should be NULL after resolving
   ```

---

### Scenario 6: Opt-Out Testing ❌

**Test STOP keyword:**

1. **Send STOP Message:**
   - Reply "STOP" to any message from your phone

2. **Expected Response:**
   ```
   AgentSpace: You have been unsubscribed and will receive no further messages.
   For assistance, contact ashok@useagentspace.com.
   ```

3. **Verify Opt-Out Status:**
   ```sql
   SELECT
       d.client_name,
       c.sms_opt_in_status,
       c.opted_out_at
   FROM conversations c
   JOIN deals d ON c.deal_id = d.id
   WHERE c.client_phone = '6692456363'
   AND c.sms_opt_in_status = 'opted_out';
   ```

4. **Check UI Shows Badge:**
   - Go to SMS page
   - Select the conversation
   - Should see RED badge: "Client has opted out of SMS messages"

5. **Try to Send Message:**
   - Attempt to send a message via UI
   - Should be blocked with error: "Client has opted out of SMS messages"

---

### Scenario 7: HELP Keyword Testing ℹ️

**Test HELP keyword:**

1. **Send HELP Message:**
   - Reply "HELP" to any message from your phone

2. **Expected Response:**
   ```
   AgentSpace: For assistance, email ashok@useagentspace.com.
   Visit useagentspace.com/privacy for our privacy policy and
   useagentspace.com/terms for terms & conditions.
   ```

3. **Verify in Messages:**
   ```sql
   SELECT
       body,
       sent_at,
       metadata
   FROM messages
   WHERE metadata->>'type' = 'help_response'
   ORDER BY sent_at DESC
   LIMIT 1;
   ```

---

### Scenario 8: Start New Conversation 💬

**Test starting conversation from policy details:**

1. **Navigate to Book of Business:**
   - Go to `/policies/book`

2. **Click on Fresh Deal:**
   - Find policy "SMS-FRESH-001" (Fresh Deal Client)
   - Click to open policy details modal

3. **Check "Start Conversation" Button:**
   - Should see "No conversation yet" message
   - "Start Conversation" button should be visible

4. **Click Start Conversation:**
   - Click the button
   - Modal should show:
     - Title: "Start SMS Conversation"
     - Preview: "Thanks for your policy with [Agency Name]. You'll receive policy updates..."
     - Button: "Send Welcome & Start"

5. **Send Welcome Message:**
   - Click "Send Welcome & Start"
   - You should receive SMS immediately:
   ```
   Thanks for your policy with [Agency Name]. You'll receive policy updates and
   reminders by text. Message frequency may vary. Msg&data rates may apply.
   Reply STOP to opt out. Reply HELP for help.
   ```

6. **Verify Conversation Created:**
   ```sql
   SELECT
       c.id,
       c.sms_opt_in_status,
       c.opted_in_at,
       d.client_name
   FROM conversations c
   JOIN deals d ON c.deal_id = d.id
   WHERE d.policy_number = 'SMS-FRESH-001';

   -- Should show:
   -- sms_opt_in_status: 'opted_in'
   -- opted_in_at: (timestamp)
   ```

---

### Scenario 9: Pending Opt-In Blocking ⏳

**Verify pending opt-in blocks messages:**

1. **Check Conversation Status:**
   ```sql
   SELECT
       d.client_name,
       c.sms_opt_in_status,
       c.opted_in_at
   FROM conversations c
   JOIN deals d ON c.deal_id = d.id
   WHERE d.policy_number = 'SMS-PEND-001';

   -- Should show:
   -- sms_opt_in_status: 'pending'
   -- opted_in_at: NULL
   ```

2. **Run Birthday Cron (has birthday today):**
   ```bash
   curl -X GET "http://localhost:3000/api/cron/birthday-messages" \
        -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Verify NO Message Sent:**
   - Should NOT receive SMS
   - Check logs should show "Skipping deal: Client has not opted in"

4. **Try Manual Message:**
   - Go to SMS page
   - Try to send message to "Pending Opt-in Client"
   - Should be blocked with error

---

### Scenario 10: Duplicate Prevention 🚫

**Test that same phone number doesn't create multiple conversations:**

1. **Create Another Deal with Same Phone:**
   ```sql
   INSERT INTO deals (
       agent_id, carrier_id, product_id, agency_id,
       client_name, client_phone, client_email,
       policy_number, monthly_premium, annual_premium,
       status, policy_effective_date, billing_cycle
   )
   SELECT
       agent_id, carrier_id, product_id, agency_id,
       'Duplicate Test Client',
       '6692456363',
       'duplicate@smstest.com',
       'SMS-DUP-001',
       100.00, 1200.00,
       'active',
       CURRENT_DATE,
       'monthly'
   FROM deals
   WHERE policy_number = 'SMS-FRESH-001'
   LIMIT 1;
   ```

2. **Try to Start Conversation:**
   - Go to policy details for "SMS-DUP-001"
   - Click "Start Conversation"
   - Should show: "Conversation already exists for this client"
   - Should redirect to existing conversation

3. **Verify No Duplicate Created:**
   ```sql
   SELECT COUNT(*) as conversation_count
   FROM conversations
   WHERE client_phone = '6692456363'
   AND agency_id = (SELECT id FROM agencies WHERE code = 'agentspace' LIMIT 1);

   -- Should still be same count as before (9 or 10)
   ```

---

## 📊 Complete Test Results Matrix

After running all tests, you should have these results:

| Scenario | SMS Sent | Status Change | UI Update | Expected Result |
|----------|----------|---------------|-----------|-----------------|
| 1. Birthday (Opted In) | ✅ | - | - | Message received |
| 2. Birthday (Opted Out) | ❌ | - | Red badge | Blocked |
| 3. Billing (Opted In) | ✅ | - | - | Message received |
| 4. Billing (Opted Out) | ❌ | - | Red badge | Blocked |
| 5. Lapse Pending | ✅ | → lapse_notified | Yellow banner | Message + status change |
| 6. Lapse Notified | ❌ | No change | Yellow banner + Resolve | Already notified |
| 7. Needs Info | ❌ | → needs_more_info_notified | Blue banner | Status change only |
| 8. Needs Info Notified | ❌ | No change | Blue banner + Resolve | Already notified |
| 9. Fresh Deal | ✅ | Conversation created | Shows conversation | Welcome sent |
| 10. Pending Opt-in | ❌ | - | - | All blocked |

**Total SMS Messages Expected: 4**
1. Birthday (Scenario 1)
2. Billing (Scenario 3)
3. Lapse (Scenario 5)
4. Welcome (Scenario 9)

---

## 🧹 Cleanup After Testing

```sql
-- Run cleanup script in Supabase SQL Editor
\i cleanup_sms_test_data.sql
```

This removes:
- All test messages
- All test conversations
- All test deals
- Test agent
- Test products (if created)

---

## 🔍 Troubleshooting

### No SMS Received

1. **Check Telnyx API Key:**
   ```bash
   echo $TELNYX_API_KEY
   ```

2. **Check Agency Phone Number:**
   ```sql
   SELECT name, phone_number
   FROM agencies
   WHERE code = 'agentspace';
   ```

3. **Check Telnyx Logs:**
   - Go to Telnyx dashboard
   - Check message logs
   - Verify number is provisioned

4. **Check Application Logs:**
   ```bash
   # Look for SMS sending errors
   grep "Error sending" logs/*.log
   ```

### Cron Jobs Not Running

1. **Check CRON_SECRET:**
   ```bash
   echo $CRON_SECRET
   ```

2. **Run with Correct Header:**
   ```bash
   curl -X GET "http://localhost:3000/api/cron/birthday-messages" \
        -H "Authorization: Bearer YOUR_ACTUAL_CRON_SECRET" \
        -v
   ```

3. **Check Response:**
   - Should return 200 status
   - Check `sent`, `failed`, `skipped` counts

### Conversations Not Creating

1. **Check for Errors:**
   ```sql
   -- Look for constraint violations
   SELECT * FROM conversations
   WHERE client_phone = '6692456363'
   ORDER BY created_at DESC;
   ```

2. **Verify Agency ID:**
   ```sql
   SELECT id FROM agencies WHERE code = 'agentspace';
   ```

---

## ✅ Success Criteria

All tests pass when:

- ✅ Receive exactly 4 SMS messages (birthday, billing, lapse, welcome)
- ✅ Opted-out scenarios send NO messages
- ✅ Pending opt-in blocks all messages
- ✅ Status changes work (lapse_pending → lapse_notified)
- ✅ Resolve buttons clear notifications
- ✅ STOP keyword opts out and blocks future messages
- ✅ HELP keyword sends help message
- ✅ Duplicate conversations prevented
- ✅ Fresh conversation sends welcome message
- ✅ UI shows correct badges and notifications

---

## 📞 Support

If issues persist:
1. Check `SMS_COMPLIANCE_IMPLEMENTATION.md` for system overview
2. Check `CONVERSATION_FIXES.md` for recent fixes
3. Review console logs for detailed error messages
4. Verify database schema matches migration

