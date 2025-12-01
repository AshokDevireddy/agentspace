# Billing Cycle Implementation Summary

## What Changed

### Old System (Calendar Month)
- Resets happened at the start of each **calendar month**
- Used top-up credits for overages
- Example: User subscribed Nov 17, limits reset Dec 1

### New System (Stripe Billing Cycle)
- Resets happen at **Stripe billing cycle renewal**
- Uses **Stripe metered billing** for overages (no top-ups)
- Example: User subscribed Nov 17, limits reset Dec 17, Jan 17, etc.

---

## Files Changed

### 1. `/src/app/api/webhooks/stripe/route.ts`
- Added billing cycle date tracking from Stripe subscription
- Automatically resets usage counters when billing cycle renews
- Updates `billing_cycle_start` and `billing_cycle_end` from Stripe webhooks

### 2. `/src/app/api/sms/send/route.ts`
- Changed from calendar month logic to billing cycle logic
- Checks `billing_cycle_end` instead of calendar months
- Removed top-up credit logic

### 3. `/src/app/api/ai/chat/route.ts`
- Changed from calendar month logic to billing cycle logic
- Checks `billing_cycle_end` instead of calendar months
- Removed top-up credit logic

### 4. Database Schema (see `BILLING_CYCLE_MIGRATION.sql`)
- Added `billing_cycle_start` column
- Added `billing_cycle_end` column
- Optionally remove `messages_topup_credits` and `ai_requests_topup_credits`

---

## How It Works Now

### 1. **User Subscribes**
```
Stripe Event: checkout.session.completed
↓
Webhook sets:
- billing_cycle_start = subscription.current_period_start
- billing_cycle_end = subscription.current_period_end
- messages_sent_count = 0
- ai_requests_count = 0
```

### 2. **User Uses Service (Messages/AI)**
```
Check: Is NOW > billing_cycle_end?
├─ NO → Increment counter, check if over limit
│         └─ If over limit: Report usage to Stripe metered billing
└─ YES → Reset counter to 0, update reset_date
          Then increment counter, check if over limit
```

### 3. **Billing Cycle Renews**
```
Stripe Event: customer.subscription.updated
↓
Webhook detects billing cycle change
↓
Updates:
- billing_cycle_start = new current_period_start
- billing_cycle_end = new current_period_end
- messages_sent_count = 0 (reset for new cycle)
- ai_requests_count = 0 (reset for new cycle)
```

### 4. **User Gets Invoiced**
```
Stripe automatically invoices:
- Base subscription fee ($50/month for Basic)
- Metered usage charges (messages over limit × $0.05)
- Metered AI usage charges (requests over limit × $0.25)
```

---

## Example Timeline

**User subscribes on Nov 17, 2025:**

| Date | Event | Messages Sent | Billing Status |
|------|-------|---------------|----------------|
| Nov 17 | Subscribe (Basic tier) | 0 | billing_cycle_end = Dec 17 |
| Nov 20 | Sends 50 messages | 50 | At tier limit |
| Nov 25 | Sends 10 more messages | 60 | Over limit by 10, usage reported to Stripe |
| Dec 1 | (Calendar month change) | 60 | **NO RESET** - not end of billing cycle |
| Dec 17 | Stripe renewal | 0 | **RESET** - new billing cycle starts |
| Dec 17 | Invoice generated | 0 | Charged: $50 base + (10 × $0.05) overage = $50.50 |
| Dec 20 | Sends 40 messages | 40 | Within limit |
| Jan 17 | Stripe renewal | 0 | **RESET** - new billing cycle starts |

---

## Migration Steps

### Step 1: Run SQL Migration
```bash
# Open BILLING_CYCLE_MIGRATION.sql in Supabase SQL editor
# Review and execute the migration
```

### Step 2: Test with Stripe CLI
```bash
# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger a subscription renewal test
stripe trigger customer.subscription.updated
```

### Step 3: Verify Billing Cycle Dates
```sql
SELECT
  email,
  subscription_tier,
  billing_cycle_start,
  billing_cycle_end,
  messages_sent_count,
  ai_requests_count
FROM users
WHERE subscription_tier != 'free';
```

### Step 4: Monitor Logs
Watch for these log messages:
- `✅ Reset message counter for user X - new billing cycle started`
- `✅ Reset AI request counter for user X - new billing cycle started`
- `💰 User X will be charged $Y for message overage`

---

## Important Notes

### ✅ **What Gets Reset at Billing Cycle Renewal:**
- `messages_sent_count` → 0
- `ai_requests_count` → 0
- `messages_reset_date` → updated
- `ai_requests_reset_date` → updated

### ❌ **What NEVER Gets Reset:**
- `deals_created_count` (never resets)
- Top-up credits (no longer used)

### 🔄 **Automatic Updates from Stripe:**
- `billing_cycle_start`
- `billing_cycle_end`
- Usage counters (on renewal)

### 💰 **Metered Billing:**
- Messages over limit: $0.05 per message
- AI requests over limit: $0.25 per request
- Billed at end of each billing cycle
- No upfront top-up purchases needed

---

## Testing Checklist

- [ ] Run `BILLING_CYCLE_MIGRATION.sql` in Supabase
- [ ] Verify all existing users have `billing_cycle_start` and `billing_cycle_end` set
- [ ] Create test subscription and verify billing cycle dates are set
- [ ] Send message when past `billing_cycle_end` and verify reset
- [ ] Make AI request when past `billing_cycle_end` and verify reset
- [ ] Exceed tier limit and verify metered usage reported to Stripe
- [ ] Trigger subscription renewal webhook and verify counters reset
- [ ] Check Stripe Dashboard for metered usage records

---

## Rollback Plan

If you need to rollback to calendar month logic:

1. Revert code changes in:
   - `/src/app/api/sms/send/route.ts`
   - `/src/app/api/ai/chat/route.ts`
   - `/src/app/api/webhooks/stripe/route.ts`

2. Keep database columns (they won't hurt anything if unused):
   ```sql
   -- Don't drop columns, just leave them unused
   -- billing_cycle_start
   -- billing_cycle_end
   ```

3. Calendar month logic will work with existing `messages_reset_date` fields

---

**Migration Date:** November 26, 2025
**Author:** Claude Code
**Status:** Ready for Testing
