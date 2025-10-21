# SMS Testing Guide - Step by Step

## ✅ Prerequisites Checklist

Before testing, ensure you have:
- [x] Run database migration SQL (creates `conversations` and `messages` tables)
- [x] Added `TELNYX_API_KEY` to `.env.local`
- [x] Configured agency phone number in Configuration → SMS Settings
- [x] Telnyx phone number is active and configured for messaging
- [x] Dev server running: `npm run dev`

## 📱 All SMS Messages Currently Implemented

### 1. **Welcome Message** (NEW! ✨)
- **Trigger**: When a new deal is created
- **Message**:
  ```
  Welcome {client_first_name}! Thank you for choosing {agency_name} for your life insurance needs.
  Your agent {agent_name} is here to help. Complete your account setup here: {setup_link}.
  If you have any questions, feel free to reply to this message!
  ```

### 2. **Birthday Message**
- **Trigger**: Client's date_of_birth matches today (month & day)
- **Message**:
  ```
  Happy Birthday, {first_name}! Wishing you a great year ahead from your friends at {agency_name}.
  ```

### 3. **Lapse Reminder**
- **Trigger**: Deal status = 'lapse_pending'
- **Message**:
  ```
  Hi {client_name}, your life insurance policy is pending lapse.
  Your agent {agent_name} will reach out soon.
  If you'd like to speak with them now, call {agent_phone}.
  ```

### 4. **Billing Reminder**
- **Trigger**: 3 days before next billing date
- **Message**:
  ```
  Hi {first_name}, this is a friendly reminder that your insurance premium is due soon.
  Please ensure funds are available for your scheduled payment. Thank you!
  ```

### 5. **Manual Agent Message**
- **Trigger**: Agent sends from SMS page
- **Message**: Custom text from agent

### 6. **Urgent Reply Forwarding**
- **Trigger**: Client replies with urgent keywords
- **Message**: Forwards to agent's phone

---

## 🧪 Testing Each Message Type

### Test 1: Welcome Message (After Deal Creation)

**Setup:**
1. Make sure you have a client with a phone number
2. Make sure the agent has an agency_id with phone_number configured

**Steps:**
```bash
# 1. Create a new deal via API or UI
# If using API:
curl -X POST http://localhost:3000/api/deals \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "agent_id": "your-agent-id",
    "carrier_id": "your-carrier-id",
    "product_id": "your-product-id",
    "client_name": "John Doe",
    "client_phone": "+15551234567",
    "client_email": "john@example.com",
    "policy_number": "POL123456",
    "monthly_premium": 100,
    "annual_premium": 1200,
    "status": "pending"
  }'

# 2. Check your terminal/console logs for:
# "[Deals API] Sending welcome SMS to client"
# "[Deals API] Welcome SMS sent successfully"

# 3. Client should receive SMS immediately
# 4. Check SMS page at /communications/sms - conversation should appear
```

**What to verify:**
- ✅ Client receives SMS
- ✅ Message includes agent name, agency name, and setup link
- ✅ Conversation appears in SMS dashboard
- ✅ Message is logged in database

---

### Test 2: Birthday Message

**Setup:**
1. Create or update a deal with `date_of_birth` = today's date (but any year)

**Steps:**
```bash
# 1. Update a deal to have today's birthday
# In your database or via Supabase dashboard:
UPDATE deals
SET date_of_birth = '1990-12-25'  -- Use today's month-day
WHERE id = 'your-deal-id';

# 2. Manually trigger the cron job
curl http://localhost:3000/api/cron/birthday-messages

# 3. Check response:
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "total": 1
}

# 4. Client should receive SMS
# 5. Check SMS page - message should appear
```

**Quick Database Setup:**
```sql
-- Find a deal and set birthday to today
UPDATE deals
SET date_of_birth = CURRENT_DATE
WHERE client_phone IS NOT NULL
LIMIT 1;
```

**What to verify:**
- ✅ Returns success with count of messages sent
- ✅ Client receives birthday message
- ✅ Message appears in SMS dashboard
- ✅ Check console logs for processing details

---

### Test 3: Lapse Reminder

**Setup:**
1. Create or update a deal with status = 'lapse_pending'

**Steps:**
```bash
# 1. Update a deal to lapse_pending status
# In your database:
UPDATE deals
SET status = 'lapse_pending'
WHERE id = 'your-deal-id'
AND client_phone IS NOT NULL;

# 2. Manually trigger the cron job
curl http://localhost:3000/api/cron/lapse-reminders

# 3. Check response:
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "total": 1
}

# 4. Deal status should update to 'lapse_notified'
# 5. Client receives SMS
# 6. Check SMS page
```

**Quick Database Setup:**
```sql
-- Set a deal to lapse_pending
UPDATE deals
SET status = 'lapse_pending'
WHERE client_phone IS NOT NULL
LIMIT 1;
```

**What to verify:**
- ✅ Client receives lapse reminder
- ✅ Deal status changes to 'lapse_notified'
- ✅ Message includes agent name and phone
- ✅ Message logged in database

---

### Test 4: Billing Reminder

**Setup:**
1. Create/update a deal with billing cycle and effective date set so next billing is in 3 days

**Steps:**
```bash
# 1. Set up a deal with billing date in 3 days
# Calculate: If today is Dec 25, and billing cycle is monthly,
# set policy_effective_date to Dec 28 (so next billing is Dec 28)

# In your database:
UPDATE deals
SET
  billing_cycle = 'monthly',
  policy_effective_date = (CURRENT_DATE + INTERVAL '3 days'),
  status = 'active'
WHERE id = 'your-deal-id'
AND client_phone IS NOT NULL;

# 2. Manually trigger the cron job
curl http://localhost:3000/api/cron/billing-reminders

# 3. Check response:
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "skipped": 0,
  "total": 1
}
```

**Quick Database Setup:**
```sql
-- Set billing to trigger in 3 days
UPDATE deals
SET
  billing_cycle = 'monthly',
  policy_effective_date = (CURRENT_DATE + INTERVAL '3 days'),
  status = 'active'
WHERE client_phone IS NOT NULL
LIMIT 1;
```

**What to verify:**
- ✅ Returns sent count
- ✅ Client receives billing reminder
- ✅ Message appears in dashboard
- ✅ Console shows billing date calculation

---

### Test 5: Manual Agent Message

**Steps:**
```bash
# 1. Go to http://localhost:3000/communications/sms

# 2. You should see existing conversations (if any)
# If no conversations, create a deal first (Test 1)

# 3. Click on a conversation

# 4. Type a message and send

# 5. Check:
# - Message appears in chat
# - Client receives SMS (if using real Telnyx)
# - Message is right-aligned (outbound)
```

**API Testing:**
```bash
# Send via API
curl -X POST http://localhost:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "dealId": "your-deal-id",
    "message": "Hi! This is a test message from your agent."
  }'
```

**What to verify:**
- ✅ Message sends successfully
- ✅ Returns conversation ID
- ✅ Message appears in UI
- ✅ Client receives SMS

---

### Test 6: Inbound Messages & Urgent Forwarding

**Setup:**
1. Configure Telnyx webhook (requires ngrok for local testing)

**Steps:**
```bash
# 1. Start ngrok (in a separate terminal)
ngrok http 3000

# 2. Copy the ngrok URL (e.g., https://abc123.ngrok.io)

# 3. Configure Telnyx webhook:
# - Go to portal.telnyx.com
# - Messaging → Webhooks
# - Set webhook URL: https://abc123.ngrok.io/api/telnyx-webhook

# 4. Have the client text your Telnyx number
# Test with: "Hi, I can't pay this month"

# 5. Check:
# - Your terminal shows webhook received
# - Message appears in SMS dashboard (left-aligned)
# - If urgent keywords detected, agent's phone receives forwarded message
```

**Test Webhook Locally:**
```bash
# Simulate webhook call
curl -X POST http://localhost:3000/api/telnyx-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "event_type": "message.received",
      "payload": {
        "from": {
          "phone_number": "+15551234567"
        },
        "to": [
          {
            "phone_number": "+15559876543"
          }
        ],
        "text": "I cannot pay my premium this month",
        "id": "test-message-id"
      }
    }
  }'
```

**Urgent Keywords to Test:**
- "don't have money"
- "can't pay"
- "call me"
- "need help"
- "emergency"
- "urgent"

**What to verify:**
- ✅ Inbound message appears (left-aligned)
- ✅ Urgent messages forward to agent phone
- ✅ All messages logged in database
- ✅ Conversation updates last_message_at

---

## 🔍 How to Check Results

### 1. Check Console Logs
```bash
# Look for these log messages:
[Deals API] Sending welcome SMS to client
[Deals API] Welcome SMS sent successfully
Running birthday messages cron for 12/25
Sent birthday message to John Doe
```

### 2. Check Database
```sql
-- View all conversations
SELECT * FROM conversations ORDER BY last_message_at DESC;

-- View all messages
SELECT
  m.*,
  c.agent_id,
  d.client_name
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN deals d ON c.deal_id = d.id
ORDER BY m.sent_at DESC;

-- Check automated messages
SELECT * FROM messages WHERE metadata->>'automated' = 'true';

-- Check message types
SELECT
  metadata->>'type' as message_type,
  COUNT(*)
FROM messages
GROUP BY metadata->>'type';
```

### 3. Check SMS Dashboard
```
1. Go to http://localhost:3000/communications/sms
2. Should see all conversations
3. Click to view messages
4. Blue messages (right) = outbound from agent
5. White messages (left) = inbound from client
6. Automated messages show "Automated message" label
```

### 4. Check Telnyx Portal
```
1. Go to portal.telnyx.com
2. Messaging → Message History
3. See all sent/received SMS
4. Check status and delivery info
```

---

## 🐛 Troubleshooting

### Message Not Sending
```bash
# Check these in order:

# 1. Is TELNYX_API_KEY set?
echo $TELNYX_API_KEY

# 2. Is agency phone configured?
SELECT phone_number FROM agencies WHERE id = 'your-agency-id';

# 3. Is client phone valid?
SELECT client_phone FROM deals WHERE id = 'your-deal-id';

# 4. Check console for errors
# Look for: "TELNYX_API_KEY is not configured"
#           "Agency phone number not configured"
```

### Conversation Not Appearing
```bash
# 1. Check if deal exists
SELECT * FROM deals WHERE id = 'your-deal-id';

# 2. Check if conversation created
SELECT * FROM conversations WHERE deal_id = 'your-deal-id';

# 3. Check if agent matches logged-in user
SELECT agent_id FROM deals WHERE id = 'your-deal-id';
```

### Webhook Not Working
```bash
# 1. Verify ngrok is running
curl https://your-ngrok-url.ngrok.io/api/telnyx-webhook

# 2. Check webhook URL in Telnyx portal matches ngrok URL

# 3. Test webhook locally
curl -X POST http://localhost:3000/api/telnyx-webhook \
  -H "Content-Type: application/json" \
  -d '{"data":{"event_type":"message.received","payload":{"from":{"phone_number":"+15551234567"},"to":[{"phone_number":"+15559876543"}],"text":"test","id":"123"}}}'
```

---

## 📊 Test Checklist

Use this to track your testing:

- [ ] **Welcome Message**: Create deal → SMS sent → Appears in dashboard
- [ ] **Birthday Message**: Set DOB to today → Run cron → SMS sent
- [ ] **Lapse Reminder**: Set status to lapse_pending → Run cron → SMS sent
- [ ] **Billing Reminder**: Set billing in 3 days → Run cron → SMS sent
- [ ] **Manual Message**: Send from UI → Client receives → Logged
- [ ] **Inbound Message**: Client texts → Shows in dashboard → Left-aligned
- [ ] **Urgent Forward**: Client texts urgent keyword → Agent phone receives
- [ ] **Database Check**: All messages in `messages` table
- [ ] **Conversation Check**: Conversations update `last_message_at`
- [ ] **Telnyx Portal**: Messages show in message history

---

## 🚀 Quick Test Script

Run this in your terminal to test all crons at once:

```bash
#!/bin/bash
echo "Testing Birthday Messages..."
curl -s http://localhost:3000/api/cron/birthday-messages | jq

echo "\nTesting Lapse Reminders..."
curl -s http://localhost:3000/api/cron/lapse-reminders | jq

echo "\nTesting Billing Reminders..."
curl -s http://localhost:3000/api/cron/billing-reminders | jq

echo "\nDone!"
```

Save as `test-sms.sh`, make executable with `chmod +x test-sms.sh`, and run with `./test-sms.sh`

---

## 📝 Summary of All Endpoints

```
# Manual SMS Operations (require auth)
POST   /api/sms/send                     # Send SMS to client
GET    /api/sms/conversations            # Get all conversations
GET    /api/sms/messages?conversationId= # Get messages

# Automated Cron Jobs (no auth for local testing)
GET    /api/cron/birthday-messages       # Birthday wishes
GET    /api/cron/lapse-reminders         # Lapse notifications
GET    /api/cron/billing-reminders       # Billing reminders

# Webhook (called by Telnyx)
POST   /api/telnyx-webhook               # Receive inbound SMS

# Deal Creation (triggers welcome message)
POST   /api/deals                        # Create deal (sends welcome SMS)
```

---

## ✨ Pro Tips

1. **Testing Without Real SMS**: Set `TELNYX_API_KEY` to empty string and check console logs - everything will run except actual SMS sending

2. **Quick Database Resets**:
   ```sql
   DELETE FROM messages;
   DELETE FROM conversations;
   ```

3. **Test with Multiple Clients**: Create multiple deals with different scenarios (birthdays, lapse, billing) and run all crons at once

4. **Check Message Metadata**: All automated messages have `metadata.automated = true` and `metadata.type` set

5. **Use ngrok for Webhooks**: Essential for testing inbound messages locally
   ```bash
   ngrok http 3000
   # Then update Telnyx webhook URL
   ```

---

Happy Testing! 🎉

