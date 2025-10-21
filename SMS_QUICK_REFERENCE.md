# SMS Quick Reference Card 🚀

## ⚡ All SMS Messages

| Message Type | Trigger | Can Test Now? |
|-------------|---------|---------------|
| **Welcome Message** | New deal created | ✅ YES - Create a deal |
| **Birthday Message** | DOB = today | ✅ YES - Update DOB to today, run cron |
| **Lapse Reminder** | Status = 'lapse_pending' | ✅ YES - Update status, run cron |
| **Billing Reminder** | 3 days before billing | ✅ YES - Set billing in 3 days, run cron |
| **Manual Message** | Agent sends from UI | ✅ YES - Use SMS page |
| **Inbound Handling** | Client replies | ✅ YES - Use ngrok + real SMS |

## 🎯 Fast Testing Commands

### Test All Crons At Once
```bash
# Birthday
curl http://localhost:3000/api/cron/birthday-messages

# Lapse
curl http://localhost:3000/api/cron/lapse-reminders

# Billing
curl http://localhost:3000/api/cron/billing-reminders
```

### Setup Test Data (Run in Supabase SQL Editor)
```sql
-- Birthday message (change date to today)
UPDATE deals
SET date_of_birth = CURRENT_DATE
WHERE client_phone IS NOT NULL
LIMIT 1;

-- Lapse message
UPDATE deals
SET status = 'lapse_pending'
WHERE client_phone IS NOT NULL
LIMIT 1;

-- Billing message (due in 3 days)
UPDATE deals
SET
  billing_cycle = 'monthly',
  policy_effective_date = (CURRENT_DATE + INTERVAL '3 days'),
  status = 'active'
WHERE client_phone IS NOT NULL
LIMIT 1;
```

### Create a Test Deal (Welcome Message)
```bash
curl -X POST http://localhost:3000/api/deals \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_COOKIE" \
  -d '{
    "agent_id": "AGENT_ID",
    "carrier_id": "CARRIER_ID",
    "product_id": "PRODUCT_ID",
    "client_name": "Test Client",
    "client_phone": "+15551234567",
    "policy_number": "TEST123",
    "monthly_premium": 100,
    "annual_premium": 1200
  }'
```

## 📍 Where to Check Results

1. **Console Logs**: Check terminal for `[Deals API]`, `Running birthday messages cron`, etc.
2. **SMS Dashboard**: http://localhost:3000/communications/sms
3. **Database**:
   ```sql
   SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT 5;
   SELECT * FROM messages ORDER BY sent_at DESC LIMIT 10;
   ```
4. **Telnyx Portal**: portal.telnyx.com → Messaging → Message History

## 🔥 Common Issues

| Problem | Solution |
|---------|----------|
| No SMS sent | Check TELNYX_API_KEY in .env.local |
| "Agency phone not configured" | Go to Configuration → SMS Settings |
| Conversation not showing | Check if deal has agent_id matching your user |
| Webhook not working | Use ngrok: `ngrok http 3000` |

## 📱 Message Examples

### Welcome Message
```
Welcome John! Thank you for choosing ABC Insurance for your life insurance needs.
Your agent Sarah Smith is here to help. Complete your account setup here:
https://yourapp.com/setup-account. If you have any questions, feel free to
reply to this message!
```

### Birthday Message
```
Happy Birthday, John! Wishing you a great year ahead from your friends at ABC Insurance.
```

### Lapse Reminder
```
Hi John Doe, your life insurance policy is pending lapse. Your agent Sarah Smith
will reach out soon. If you'd like to speak with them now, call (555) 123-4567.
```

### Billing Reminder
```
Hi John, this is a friendly reminder that your insurance premium is due soon.
Please ensure funds are available for your scheduled payment. Thank you!
```

## 🎬 Step-by-Step: Test Everything in 5 Minutes

1. **Prepare database** (30 seconds)
   ```sql
   -- Run all 3 UPDATE commands from "Setup Test Data" above
   ```

2. **Test Birthday** (30 seconds)
   ```bash
   curl http://localhost:3000/api/cron/birthday-messages
   ```

3. **Test Lapse** (30 seconds)
   ```bash
   curl http://localhost:3000/api/cron/lapse-reminders
   ```

4. **Test Billing** (30 seconds)
   ```bash
   curl http://localhost:3000/api/cron/billing-reminders
   ```

5. **Test Welcome** (1 minute)
   - Go to UI → Post a Deal
   - Fill in form with client phone
   - Submit → SMS sends automatically

6. **Test Manual** (1 minute)
   - Go to http://localhost:3000/communications/sms
   - Click conversation
   - Send test message

7. **Check Results** (1.5 minutes)
   - Check SMS dashboard
   - Check console logs
   - Query database

**Total: ~5 minutes to test all SMS functionality!**

## 🛠️ Environment Setup Checklist

- [ ] Database migration SQL executed
- [ ] `TELNYX_API_KEY` in `.env.local`
- [ ] `NEXT_PUBLIC_APP_URL` in `.env.local`
- [ ] Agency phone number configured in UI
- [ ] At least one deal with valid client phone
- [ ] Dev server running (`npm run dev`)
- [ ] (Optional) ngrok running for webhooks

## 💡 Pro Tips

- **Don't wait for cron schedules**: Manually call the cron endpoints!
- **Use Supabase dashboard**: Quickly update test data
- **Check metadata**: All automated messages have `metadata.automated = true`
- **Test with your own phone**: Best way to verify end-to-end
- **Use ngrok free tier**: Perfect for webhook testing locally

## 📚 Full Documentation

For detailed testing steps, see: `SMS_TESTING_GUIDE.md`
For setup instructions, see: `SMS_SETUP_INSTRUCTIONS.md`

---

**Need Help?** Check the console logs first - they show exactly what's happening!

