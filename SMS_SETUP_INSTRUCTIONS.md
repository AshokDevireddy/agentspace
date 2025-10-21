# SMS Messaging System Setup Instructions

## Overview
This document provides setup instructions for the Telnyx-powered SMS automation and communication logging system.

## 1. Database Migration

Run the following SQL in your Supabase SQL Editor:

```sql
-- Add phone_number column to agencies table
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS phone_number text NULL;

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'sms',
  last_message_at timestamptz NULL DEFAULT now(),
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_agent_deal_unique UNIQUE (agent_id, deal_id, type),
  CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT conversations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  CONSTRAINT conversations_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  CONSTRAINT conversations_type_check CHECK (type IN ('sms', 'email'))
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON public.conversations USING btree (agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_deal ON public.conversations USING btree (deal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agency ON public.conversations USING btree (agency_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations USING btree (type);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations USING btree (last_message_at DESC);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  body text NOT NULL,
  direction text NOT NULL,
  message_type text NULL DEFAULT 'sms',
  sent_at timestamptz NULL DEFAULT now(),
  status text NULL DEFAULT 'delivered',
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT messages_direction_check CHECK (direction IN ('inbound', 'outbound'))
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON public.messages USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON public.messages USING btree (direction);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations (agents can see their own conversations)
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- RLS Policies for messages (users can see messages in their conversations)
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE agent_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Allow inserting messages (will be controlled by API)
CREATE POLICY "Allow insert messages" ON public.messages
  FOR INSERT WITH CHECK (true);

-- Allow inserting conversations (will be controlled by API)
CREATE POLICY "Allow insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

-- Allow updating conversations (for last_message_at)
CREATE POLICY "Allow update conversations" ON public.conversations
  FOR UPDATE USING (true);
```

## 2. Environment Variables

Add these to your `.env.local` file:

```bash
# Telnyx API Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_WEBHOOK_SECRET=your_telnyx_webhook_secret_here

# Cron Job Security (optional but recommended)
CRON_SECRET=your_random_secret_string_here
```

### How to get Telnyx credentials:

**TELNYX_API_KEY:**
1. Log in to https://portal.telnyx.com
2. Go to "API Keys" in the left sidebar
3. Click "Create API Key"
4. Name it "AgentSpace SMS"
5. Copy the API key (starts with "KEY...")

**TELNYX_WEBHOOK_SECRET:**
1. In Telnyx Portal, go to "Messaging" → "Webhooks"
2. Create a new webhook pointing to: `https://your-domain.com/api/telnyx-webhook`
3. Copy the webhook signing secret (optional but recommended)

**CRON_SECRET:**
- Generate a random string (e.g., using `openssl rand -hex 32`)
- This secures your cron endpoints

## 3. Telnyx Phone Number Setup

1. Purchase a phone number in Telnyx Portal
2. Enable messaging for the number
3. Configure the number in your app:
   - Go to Configuration → SMS Settings tab
   - Enter your Telnyx phone number in E.164 format (e.g., +12345678900)
   - Save

## 4. Vercel Deployment

The `vercel.json` file has been created with cron job configurations:

- **Birthday Messages**: Runs daily at 9:00 AM
- **Lapse Reminders**: Runs every 2 hours
- **Billing Reminders**: Runs daily at 8:00 AM

After deploying to Vercel, the cron jobs will run automatically.

## 5. Features Implemented

### Frontend
- **SMS Messaging Tab** (`/communications/sms`)
  - View all SMS conversations with clients
  - Real-time conversation list
  - iMessage-style chat interface
  - Send manual SMS to clients
  - Auto-refresh every 10 seconds

- **Configuration Page**
  - New "SMS Settings" tab
  - Configure agency Telnyx phone number
  - Setup instructions included

### API Routes

**SMS Operations:**
- `POST /api/sms/send` - Send SMS to a client
- `GET /api/sms/conversations` - Get all conversations for agent
- `GET /api/sms/messages?conversationId=xxx` - Get messages for a conversation

**Webhook:**
- `POST /api/telnyx-webhook` - Receive inbound SMS from Telnyx
- Auto-forwards urgent messages to agents

**Cron Jobs:**
- `GET /api/cron/birthday-messages` - Send birthday wishes
- `GET /api/cron/lapse-reminders` - Notify clients about policy lapses
- `GET /api/cron/billing-reminders` - Remind clients about upcoming payments

### Automation

**Birthday Messages:**
- Runs daily at 9 AM
- Matches clients with birthdays today
- Sends personalized wishes

**Lapse Reminders:**
- Runs every 2 hours
- Finds deals with status = 'lapse_pending'
- Notifies clients and provides agent contact info
- Updates status to 'lapse_notified'

**Billing Reminders:**
- Runs daily at 8 AM
- Calculates next billing date based on cycle and effective date
- Sends reminders 3 days before due date

### Smart Features

**Urgent Keyword Detection:**
Inbound messages containing these keywords are forwarded to agents:
- "don't have money"
- "can't pay"
- "call me"
- "need help"
- "emergency"
- "urgent"
- "problem"
- "cancel policy"

## 6. Testing

### Test Manual SMS:
1. Go to `/communications/sms`
2. Select a conversation (or it will be created on first send)
3. Type a message and send

### Test Inbound SMS:
1. Have a client text your Telnyx number
2. Check the webhook is receiving messages (check Vercel logs)
3. Message should appear in the conversation

### Test Cron Jobs:
You can manually trigger cron jobs by visiting:
- `https://your-domain.com/api/cron/birthday-messages`
- `https://your-domain.com/api/cron/lapse-reminders`
- `https://your-domain.com/api/cron/billing-reminders`

(Include the `Authorization: Bearer YOUR_CRON_SECRET` header if CRON_SECRET is set)

## 7. Database Schema

### Conversations Table
- Links agent to client deal
- Tracks last message timestamp
- Supports multiple types (SMS, future: email)
- One active conversation per agent-deal-type

### Messages Table
- Stores all SMS messages (inbound/outbound)
- Tracks direction, status, and metadata
- Supports automated vs manual tagging
- Linked to conversation

## 8. Important Notes

1. **Client Phone Numbers**: Make sure client phone numbers are populated in the `deals` table
2. **Date of Birth**: Required in `deals` table for birthday automation
3. **Agency Assignment**: Agents must have `agency_id` set
4. **Billing Cycle**: Must be set on deals for billing reminders
5. **Policy Effective Date**: Required for calculating billing dates

## 9. Future Enhancements

- Add read/unread tracking
- Add message templates
- Add bulk SMS campaigns
- Add email support (conversations.type = 'email')
- Add attachment support
- Add SMS analytics dashboard
- Add client opt-out management
- Add A/B testing for messages

## 10. Troubleshooting

**Messages not sending:**
- Check TELNYX_API_KEY is set correctly
- Verify agency phone number is configured
- Check client phone number format in deals table

**Webhook not receiving:**
- Verify webhook URL in Telnyx Portal
- Check webhook is accessible publicly
- Review Vercel function logs

**Cron jobs not running:**
- Verify vercel.json is deployed
- Check Vercel dashboard for cron job logs
- Ensure cron endpoints are accessible

## Support

For issues, check:
1. Vercel deployment logs
2. Supabase database logs
3. Telnyx message logs in portal
4. Browser console for frontend errors

