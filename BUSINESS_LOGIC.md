# AgentSpace - Complete Business Logic Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Agency/Agent/Admin Hierarchy & Permissions](#agencyagentadmin-hierarchy--permissions)
3. [Upline/Downline Relationships](#uplinedownline-relationships)
4. [Positions System & Commission Structures](#positions-system--commission-structures)
5. [Deals & Carriers/Products](#deals--carriersproducts)
6. [Expected Payouts Calculation](#expected-payouts-calculation)
7. [Subscription & Billing Model](#subscription--billing-model)
8. [Application Pages & Their Purposes](#application-pages--their-purposes)
9. [Onboarding Wizard & User Flows](#onboarding-wizard--user-flows)
10. [Database Schema Overview](#database-schema-overview)
11. [Critical Business Logic & RPC Functions](#critical-business-logic--rpc-functions)
12. [Cron Jobs & Automated Workflows](#cron-jobs--automated-workflows)

---

## System Overview

**AgentSpace** is a comprehensive platform for managing insurance agents and their production. The system handles:
- Agent hierarchies with uplines/downlines
- Policy deals and client management
- Commission calculations based on positions
- SMS messaging and client communication
- Subscription-based access with metered billing
- Real-time analytics and scoring

### Technology Stack
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Payments**: Stripe (subscriptions + metered billing)
- **Messaging**: Telnyx SMS, Resend email
- **AI**: Anthropic Claude API (for AI Mode)

---

## Agency/Agent/Admin Hierarchy & Permissions

### Role Structure

**Three main roles:**

1. **Admin** (`role = 'admin'`)
   - Can manage entire agency
   - Can invite agents and set their uplines
   - Can view all agents' data
   - Can access Expert tier features
   - Can configure agency settings (carriers, products, commissions, positions)
   - Can assign positions to agents

2. **Agent** (`role = 'agent'`)
   - Can create deals
   - Can view their own and downline data
   - Can invite their downlines
   - Can see expected payouts (if subscription allows)
   - Limited configuration access (only their own settings)

3. **Client** (`role = 'client'`)
   - Read-only access to their own information
   - Receives SMS updates about their policies

### Permission Levels

**Database Columns:**
- `role` - Determines access level (admin, agent, client)
- `is_admin` - Legacy boolean (mapped to admin role)
- `perm_level` - Legacy permission level (being replaced by positions system)
- `upline_id` - Foreign key to their direct supervisor
- `position_id` - References the positions table

**Permission Rules:**
- Admins can see all agents in their agency
- Agents can see themselves and their direct/indirect downlines
- Admins can modify any agent in their agency
- Agents can only modify themselves and invite downlines

### User Status Lifecycle

```
'pre-invite' → 'invited' → 'onboarding' → 'active' → 'inactive'
```

- **pre-invite**: Created via admin invitation, not yet invited
- **invited**: Invitation email sent, awaiting confirmation
- **onboarding**: User confirmed email, in setup wizard
- **active**: Completed onboarding
- **inactive**: Disabled account

---

## Upline/Downline Relationships

### Hierarchy Structure

Each agent has one `upline_id` (their direct supervisor) except the top-level admin.

**Database Table:** `users.upline_id` (nullable, FK to users.id)

### Downline Retrieval

**RPC Function:** `get_agent_downline(p_agent_id)`
- Returns ALL downlines (direct and indirect)
- Used for permission checks and data visibility
- Recursive query through the hierarchy

**Example Hierarchy:**
```
Admin (top-level)
├── Agent A (upline_id = Admin)
│   ├── Agent A1 (upline_id = Agent A)
│   └── Agent A2 (upline_id = Agent A)
└── Agent B (upline_id = Admin)
    └── Agent B1 (upline_id = Agent B)
```

### Business Logic Rules

1. **Commission Flow**: Commissions flow UP the hierarchy
   - When Agent A1 writes a deal, Agent A and Admin all receive commissions based on hierarchy positions

2. **Data Visibility**: Visible DOWN the hierarchy
   - Admin sees all agents
   - Agent A sees A1, A2 (and their downlines)
   - Agent A1 sees no one below them

3. **Ownership**:
   - Deals are owned by the writing agent
   - Clients are owned by the primary agent managing them
   - Commission percentages are stored at creation (hierarchy snapshot)

---

## Positions System & Commission Structures

### Positions Table

**Table:** `positions`
- `id` - UUID, unique per agency
- `agency_id` - FK to agencies
- `name` - Position title (e.g., "Managing General Agent", "Prodigy")
- `level` - Integer (higher = more senior, e.g., EFO=10, MD=9, AO=8)
- `description` - Optional details
- `is_active` - Whether this position can be assigned

### Pre-defined Positions

Common position names include:
```
'Legacy Managing Partner', 'Legacy Senior Partner', 'Legacy Junior Partner',
'Karma Partner', 'Karma Director 2', 'Karma Director 1',
'Legacy MGA', 'Legacy GA', 'Legacy SA',
'Managing General Agent 2', 'Managing General Agent 1',
'General Agent 2', 'General Agent 1',
'Supervising Agent 2', 'Supervising Agent 1',
'Brokerage Agent',
'Legacy Prodigy', 'Prodigy', 'Junior Prodigy',
'Conservation Manager', 'Conservation Agent',
'Prodigy Manager'
```

### Commission Grid: Position-Product Commissions

**Table:** `position_product_commissions`
- `position_id` - The position
- `product_id` - The insurance product (e.g., Life, Disability)
- `commission_percentage` - e.g., 105.00 means 105%

**Key Feature:** Each position has a different commission % for each product
- This allows flexible commission structures
- Example: Manager GA might get 105% on Life but 95% on Disability
- Commissions are captured at deal creation (hierarchy snapshot)

### Assignment & Requirements

**Workflow:**
1. Admin creates positions in Configuration page
2. Admin assigns positions to agents
3. Agent + upline BOTH must have positions before posting deals
4. Position check prevents posting if either is missing (unless admin bypasses)

**Important Rule:** Agent and their direct upline must both have positions assigned before the agent can post deals.

---

## Deals & Carriers/Products

### Deal Structure

**Key Fields:**
- `id` - UUID
- `agent_id` - The writing agent
- `carrier_id` - Insurance carrier (Aetna, Aflac, etc.)
- `product_id` - Product type (Life Insurance, Disability, etc.)
- `client_name`, `client_phone`, `client_email` - Client info
- `policy_number`, `application_number` - Policy identifiers
- `monthly_premium`, `annual_premium` - Premium amounts
- `policy_effective_date` - When the policy starts
- `status` - Complex field (see below)
- `status_standardized` - Normalized status (pending, active, lapse_pending, etc.)
- `lead_source` - How the lead came (referral, provided, purchased, no-lead)
- `billing_cycle` - monthly, quarterly, semi-annually, annually
- `split_agent_id`, `split_percentage` - For deal splits (optional)

### Deal Status Complexity

**The Tricky Part:**
Different carriers report statuses differently. AgentSpace normalizes this using the `status_mapping` table:
- `Aetna` reports: "Approved", "Active", "Pending"
- `Aflac` reports: "Issued", "In Process", "Lapsed"
- All must map to standardized values

**Standardized Statuses:**
- `'pending'` - In progress
- `'active'` - Written/active (good)
- `'terminated'` - Ended (bad)
- `'lapse_pending'` - About to expire (warning)
- `'lapse_notified'` - Already sent lapse reminder
- `'needs_more_info'` - Waiting for info
- `'needs_more_info_notified'` - Notified about missing info
- `'draft'` - Not yet posted

### Deal Post Workflow (Post Deal Page)

**Steps:**
1. User fills 3-step form:
   - Step 1: Policy Information (carrier, product, effective date, premium, billing cycle, lead source)
   - Step 2: Client Information (name, email, phone, DOB, address)
   - Step 3: Review & Submit

2. System validates:
   - User has position assigned (or is admin)
   - User's upline has position assigned (or user is admin)
   - All required fields present
   - Can optionally add beneficiaries

3. Deal is posted as `status: 'draft'`

4. Hierarchy snapshot is created (captures all uplines + commissions at that moment)

### Carriers & Products

**Carriers Table:**
- `id` - UUID
- `name` - Full name (Aetna, Aflac, etc.)
- `display_name` - Display version
- `is_active` - Whether to show in UI

**Products Table:**
- `id` - UUID
- `carrier_id` - FK to carriers
- `agency_id` - Which agency can use this product
- `name` - Product name (e.g., "Term Life 20 Year")
- `product_code` - Internal code
- `is_active` - Whether available

---

## Expected Payouts Calculation

### The Formula

```
expected_payout = annual_premium * 0.75 * (agent_commission_% / hierarchy_total_commission_%)
```

**Breaking it down:**
- `annual_premium * 0.75` = Commission pool (75% of annual premium available)
- `agent_commission_%` = This specific agent's commission % from their position
- `hierarchy_total_commission_%` = Sum of ALL commission % in the hierarchy for this deal
- The division ensures the pool is split proportionally

### Deal Hierarchy Snapshot

When a deal is posted, the system captures:
- All agents in the hierarchy (from writing agent up to top-level)
- Each agent's position at that time
- Each agent's commission % for this specific product
- This is stored in `deal_hierarchy_snapshot` table

**Why?** If an agent changes positions later, their commission on this deal doesn't change. The snapshot preserves historical accuracy.

### Viewing Expected Payouts

**Page:** `/expected-payouts`

**Features:**
- Filter by agent (self or downlines, depending on role/tier)
- Filter by carrier
- Select date range (past vs future)
- Shows breakdown: Your Production + Downline Production
- Chart showing payouts over time

**Subscription Tier Requirements:**
- Free: No access
- Basic: Can view expected payouts
- Pro: Full access + downline data
- Expert: Everything + AI Mode

**Important:** Basic tier users can only view their own payouts. Need Pro tier to view downline payouts.

---

## Subscription & Billing Model

### Subscription Tiers

**4 Tiers:**

| Feature | Free | Basic | Pro | Expert |
|---------|------|-------|-----|--------|
| Price | $0 | $20/mo | $60/mo | $150/mo |
| Deals | 10 | Unlimited | Unlimited | Unlimited |
| SMS Messages | 0 (blocked) | 50/mo | 200/mo | 1000/mo |
| Message Overage | N/A | $0.10 | $0.08 | $0.05 |
| AI Requests | 0 | 0 | 0 | 50/mo |
| AI Overage | N/A | N/A | N/A | $0.25 |
| Analytics | ❌ | ❌ | ✅ | ✅ |
| Expected Payouts | ❌ | ✅ | ✅ | ✅ |
| Downline Data | ❌ | ❌ | ✅ | ✅ |
| Auto Messaging | ❌ | ❌ | ✅ | ✅ |
| Policy Reports | ❌ | ❌ | ❌ | ✅* |
| AI Mode | ❌ | ❌ | ❌ | ✅** |

\* Admin only
\*\* Admin only

### Billing Cycle Model

**Changed (Nov 2025):** From calendar month to Stripe billing cycle

**How It Works:**
1. User subscribes on Nov 17
2. Stripe sets billing cycle: Nov 17 → Dec 17
3. User can send 50 messages (Basic tier) during this period
4. If user exceeds 50 messages, overage is reported to Stripe metered billing
5. On Dec 17, cycle resets and new cycle starts Dec 17 → Jan 17

**Database Fields:**
- `billing_cycle_start` - When this cycle started
- `billing_cycle_end` - When this cycle ends
- `messages_sent_count` - Resets to 0 at cycle start
- `ai_requests_count` - Resets to 0 at cycle start

**Metered Billing:**
- No top-up credits anymore
- Overage charges are automatic via Stripe
- Invoice shows: Base fee + metered usage charges

### Stripe Integration

**Payment Flow:**
1. User selects tier → `/api/stripe/create-checkout-session`
2. Creates Stripe customer if needed
3. Stripe Checkout session created
4. Success → Webhook `checkout.session.completed` fires
5. Webhook sets `subscription_tier`, `billing_cycle_*`, resets counters

**Webhooks Handled:**
- `checkout.session.completed` - Subscription activated
- `customer.subscription.updated` - Billing cycle renewed (counters reset)
- `customer.subscription.deleted` - Subscription canceled

**Expert Tier Restriction:**
- Only admins can purchase Expert tier
- Verified in `/api/stripe/create-checkout-session`

---

## Application Pages & Their Purposes

### Main Dashboard Pages

| Page | URL | Purpose | Requires |
|------|-----|---------|----------|
| **Dashboard** | `/` | Home page, shows scoreboard, top producers | Login |
| **Agents** | `/agents` | View agent hierarchy tree, manage team | Admin or Agent |
| **Expected Payouts** | `/expected-payouts` | View commission payouts | Basic+ tier |
| **Book of Business** | `/policies/book` | View all deals/policies | Login |
| **Post Deal** | `/policies/post` | Create new policy deal | Agent, has position |
| **Clients** | `/clients` | View all clients | Login |
| **Scoreboard** | `/scoreboard` | Weekly/monthly production rankings | Login |
| **Configuration** | `/configuration` | Agency settings & admin panel | Admin |
| **AI Chat** | `/ai-chat` | AI Mode (analysis & insights) | Expert + Admin |

### Configuration Page Tabs (Admin Only)

**Sub-pages under `/configuration`:**

1. **Agency Profile**
   - Display name, logo upload
   - Primary color (HSL picker)
   - White label domain
   - Theme mode (light/dark/system)

2. **Carriers**
   - View/manage insurance carriers available
   - Add new carriers

3. **Positions**
   - View/manage agent positions
   - Define position levels

4. **Commissions**
   - Set commission % for each position-product combination
   - Commission grid editor

5. **Lead Sources**
   - Configure available lead sources
   - Examples: referral, purchased, provided, no-lead

6. **Messaging Settings**
   - Enable/disable SMS
   - Configure agency phone number
   - Discord webhook for notifications

7. **Policy Reports**
   - Upload historical policy reports (by carrier)
   - Expert tier only

8. **Discord Integration**
   - Webhook URL for deal notifications

---

## Onboarding Wizard & User Flows

### Registration Flow (New Agency Owner)

**Page:** `/register`

**Step 1: Create Account**
- Email, First Name, Last Name, Phone, Agency Name
- Validates email format and required fields
- Calls `/api/register`

**Backend Processing:**
1. Check if user already exists
2. Create agency record
3. Create Supabase auth user (via `inviteUserByEmail`)
4. Create user record with `status: 'invited'` and `role: 'admin'`
5. Send confirmation email

**Step 2: Confirm Email**
- User receives invitation email
- Clicks link → redirected to login

### Phase 1: Account Setup (Password & Profile)

**Page:** `/setup-account`

**Requirements:** User has `status: 'onboarding'`

**Updates:**
- First name, last name, phone number
- Password setup
- Confirms email verification

**Upon Completion:**
- User status → `'active'`
- Redirects to onboarding wizard

### Phase 2: Onboarding Wizard

**Page:** `/` (shown as overlay when `status: 'onboarding'`)

**Component:** `OnboardingWizard`

**Two Different Flows:**

#### For Admins (3 Steps):

**Step 1: Policy Reports Upload**
- Upload historical policy reports for each carrier
- Optional but recommended
- Helps populate historical data

**Step 2: Team Invitations**
- Add first agents/team members
- Search for pre-invited users or create new invitations
- Set upline relationships

**Step 3: Complete**
- Wizard closes
- Redirects to dashboard

#### For Agents (2 Steps - Step 2 starts at "Team"):

**Step 1: Skipped**
- Agents don't upload policy reports

**Step 2: Team Invitations**
- Can only invite their downlines
- Agent search to select upline
- Can create new team members

**Step 3: Complete**
- Wizard closes

### Agent Invite Workflow

**Who can invite:**
- Admins can invite anyone into the agency
- Agents can invite their downlines (assigns them as upline)

**Process:**
1. Provide: Email, First Name, Last Name, Phone, Role (admin/agent)
2. Select upline agent
3. System creates `pre-invite` user
4. Sends invitation email

**Upon Agent Acceptance:**
- Clicks email link
- Goes to `/setup-account` (Phase 1)
- Then onboarding wizard
- Status → `'active'`

---

## Database Schema Overview

### Core Tables

**`users`**
```
- id (UUID, PK)
- auth_user_id (UUID, FK to auth.users)
- email
- first_name, last_name
- phone_number
- role ('admin', 'agent', 'client')
- is_admin (boolean)
- perm_level (text)
- position_id (FK to positions)
- upline_id (FK to users) - nullable for top-level
- agency_id (FK to agencies)
- status ('pre-invite', 'invited', 'onboarding', 'active', 'inactive')
- subscription_tier ('free', 'basic', 'pro', 'expert')
- subscription_status ('active', 'inactive')
- stripe_customer_id, stripe_subscription_id
- billing_cycle_start, billing_cycle_end
- messages_sent_count, messages_reset_date
- ai_requests_count, ai_requests_reset_date
- deals_created_count
- created_at, updated_at
```

**`agencies`**
```
- id (UUID, PK)
- name (text)
- code (text, unique)
- display_name
- phone_number
- messaging_enabled (boolean)
- discord_webhook_url
- logo_url
- primary_color (HSL string)
- theme_mode ('light', 'dark', 'system')
- whitelabel_domain
- is_active
- created_at, updated_at
```

**`deals`**
```
- id (UUID, PK)
- agency_id (FK)
- agent_id (FK to users)
- carrier_id (FK)
- product_id (FK)
- client_name, client_email, client_phone
- date_of_birth (optional)
- policy_number, application_number
- monthly_premium, annual_premium
- policy_effective_date
- status (complex field - carrier-specific)
- status_standardized (normalized)
- lead_source
- billing_cycle
- split_agent_id, split_percentage (for splits)
- created_at, updated_at
```

**`deal_hierarchy_snapshot`**
```
- id (UUID, PK)
- deal_id (FK)
- agent_id (FK to users)
- upline_id (FK to users, nullable)
- commission_percentage (NUMERIC, e.g., 105.00)
- created_at
```

**`positions`**
```
- id (UUID, PK)
- agency_id (FK)
- name (text)
- level (integer)
- description
- is_active
- created_at, updated_at
```

**`position_product_commissions`**
```
- id (UUID, PK)
- position_id (FK)
- product_id (FK)
- commission_percentage (NUMERIC)
- created_at, updated_at
```

**`carriers`**
```
- id (UUID, PK)
- name
- display_name
- is_active
- created_at
```

**`products`**
```
- id (UUID, PK)
- carrier_id (FK)
- agency_id (FK, optional)
- name
- product_code
- is_active
- created_at
```

**`conversations`** (for SMS)
```
- id (UUID, PK)
- agent_id (FK)
- deal_id (FK)
- client_phone
- sms_opt_in_status ('opted_in', 'opted_out', 'pending')
- created_at, updated_at
```

**`sms_messages`**
```
- id (UUID, PK)
- conversation_id (FK)
- body (text)
- direction ('inbound', 'outbound')
- telnyx_message_id
- created_at
```

**`status_mapping`**
```
- carrier_id (FK)
- raw_status (text, from carrier)
- standard_status (text, normalized)
- impact ('positive', 'negative', 'neutral')
```

---

## Critical Business Logic & RPC Functions

### Key RPC Functions

**1. `get_agent_downline(p_agent_id UUID)`**
- Returns all agents below this agent in hierarchy
- Direct and indirect downlines
- Used for permission checks and data visibility

**2. `get_agent_upline_chain(p_agent_id UUID)`**
- Returns all agents ABOVE this agent
- Used when creating deals (capture hierarchy)
- Returns entire chain from agent to top

**3. `get_expected_payouts()`**
- Calculates expected payouts
- Applies permissions (admins see all, agents see self + downlines)
- Filters by date range, carrier, agent
- Returns monthly breakdown

**4. `get_position_product_commissions()`**
- Returns commission grid for an agency
- All position-product combinations
- Used in Configuration page

**5. `get_agents_without_positions()`**
- Returns agents who haven't been assigned a position yet
- Admins see all, agents see their downlines
- Used in agent management

### Creating a Deal (Core Logic)

**File:** `src/app/api/deals/route.ts` → `createDealHierarchySnapshot()`

**What Happens:**
1. User posts deal with carrier_id, product_id
2. Call `get_agent_upline_chain(writing_agent_id)` to get hierarchy
3. For each agent in chain:
   - Look up their position_id
   - Look up commission % for position + product
   - Store in `deal_hierarchy_snapshot`
4. When calculating payouts, use snapshot (not current positions)

**Why?** Preserves historical accuracy. If an agent is promoted later, their commission on past deals doesn't change.

### Billing Cycle Reset Logic

**File:** `/api/webhooks/stripe/route.ts`

**When Triggered:**
- Stripe `customer.subscription.updated` event
- Happens on renewal date

**What Happens:**
1. Extract `billing_cycle_start` and `billing_cycle_end` from Stripe subscription
2. Update user's database:
   - `billing_cycle_start` = new start date
   - `billing_cycle_end` = new end date
   - `messages_sent_count` = 0 (reset)
   - `ai_requests_count` = 0 (reset)
3. Message sending checks if NOW > `billing_cycle_end` to know if reset needed

### Message Limit Checking

**File:** `/api/sms/send/route.ts`

**Logic:**
```
1. Get user's subscription_tier and messages_sent_count
2. Check if user's billing_cycle_end < now
   - If yes: reset counter to 0
3. Check: is messages_sent_count >= tier.messages?
   - If yes: report overage to Stripe (metered billing)
4. Send message
5. Increment messages_sent_count
```

**Important:** No hard limit! Users can send unlimited messages. Overage charges apply automatically.

---

## Cron Jobs & Automated Workflows

### Cron Jobs Summary

All cron jobs now create **draft messages** instead of sending immediately. This allows admin review before sending.

**Four Cron Jobs:**

#### 1. Billing Reminders
- **File:** `src/app/api/cron/billing-reminders/route.ts`
- **Schedule:** Daily at 8 AM
- **Purpose:** Remind clients of upcoming premium payments

**Logic:**
1. Call RPC `get_billing_reminder_deals()`
2. RPC finds deals where next billing date is exactly 3 days away
3. RPC also checks if policy effective date is 3 days away
4. For each deal:
   - Get/create conversation
   - Check SMS opt-in status
   - Create draft SMS message
5. Message appears in SMS Drafts for review

**Example:**
- Deal effective date: Jan 18, monthly billing
- Today: Jan 15
- Result: ✅ Sends reminder (3 days until effective date)

#### 2. Birthday Messages
- **File:** `src/app/api/cron/birthday-messages/route.ts`
- **Schedule:** Daily at 9 AM
- **Purpose:** Send birthday wishes to clients

**Logic:**
1. Call RPC `get_birthday_message_deals()`
2. RPC matches client DOB month/day to today's month/day
3. For each matching deal:
   - Get/create conversation
   - Create draft birthday message

#### 3. Lapse Reminders
- **File:** `src/app/api/cron/lapse-reminders/route.ts`
- **Schedule:** Every 2 hours
- **Purpose:** Notify about policies pending lapse

**Logic:**
1. Call RPC `get_lapse_reminder_deals()`
2. RPC filters for `status_standardized = 'lapse_pending'`
3. For each deal:
   - Create draft lapse notice
   - **Update status_standardized to 'lapse_notified'** (immediately, even though message is draft)

#### 4. Needs More Info Notifications
- **File:** `src/app/api/cron/needs-more-info-notifications/route.ts`
- **Schedule:** Periodically
- **Purpose:** Mark deals needing information

**Logic:**
1. Query deals with `status_standardized = 'needs_more_info'`
2. Update status to `'needs_more_info_notified'`
3. No SMS sent (just status marker)

### SMS Opt-In/Out System

**Fields in `conversations` table:**
- `sms_opt_in_status` - Values: 'opted_in', 'opted_out', 'pending'

**Rules:**
- New conversations start with 'opted_in' (auto-enabled)
- Clients can text "STOP" to opt out
- Webhook processes inbound messages
- Drafts respect opt-in status (won't create for opted-out)

---

## Key File Locations

**Core Business Logic:**
- `/src/app/api/expected-payouts/route.ts` - Payout calculation
- `/src/app/api/deals/route.ts` - Deal creation & hierarchy snapshot
- `/src/app/api/positions/product-commissions/route.ts` - Commission management
- `/src/app/api/webhooks/stripe/route.ts` - Billing & subscription
- `/src/app/api/sms/send/route.ts` - Message sending & limits
- `/src/lib/subscription-tiers.ts` - Subscription tier definitions
- `/src/lib/stripe.ts` - Stripe initialization

**Pages:**
- `/src/app/page.tsx` - Dashboard
- `/src/app/expected-payouts/page.tsx` - Expected payouts display
- `/src/app/policies/post/page.tsx` - Post deal wizard
- `/src/app/policies/book/page.tsx` - Book of business
- `/src/app/agents/page.tsx` - Agent hierarchy tree
- `/src/app/configuration/page.tsx` - Admin config
- `/src/app/setup-account/page.tsx` - Account setup

**Components:**
- `/src/components/onboarding-wizard.tsx` - Onboarding flow
- `/src/components/modals/add-user-modal.tsx` - Add agents
- `/src/components/modals/add-product-modal.tsx` - Add products

**Database:**
- `/migrations/` - All schema and RPC functions
- Key migrations:
  - `add_positions_system.sql` - Positions & commissions
  - `add_expected_payouts_rpc.sql` - Payout calculation
  - `add_cron_job_rpc_functions.sql` - Cron job RPCs

---

## Common Developer Workflows

### Adding a New Commission Grid Entry

1. Admin goes to Configuration → Commissions tab
2. Select position and product
3. Enter commission percentage (e.g., 105.00 for 105%)
4. API: `/api/positions/product-commissions/` (POST)
5. Creates entry in `position_product_commissions` table
6. Next deals with that product will use new %, past deals unaffected

### Checking If User Can Perform Action

**Use function:** `canPerformAction()` from `/src/lib/subscription-tiers.ts`

```typescript
canPerformAction(userTier, 'messages', currentCount)
// Returns: boolean
```

### Debugging Commission Calculations

1. Check `deal_hierarchy_snapshot` for the deal
2. Verify all agents have positions assigned
3. Check `position_product_commissions` for this position + product combo
4. Formula: `annual_premium * 0.75 * (agent_% / total_%)`

### Adding New Cron Job

1. Create new route: `/src/app/api/cron/[name]/route.ts`
2. Implement RPC if needed in migrations
3. Configure in Vercel Cron Jobs
4. Test locally with manual HTTP call

---

## Important Notes for New Developers

1. **Status Field Complexity**: `deals.status` varies by carrier. Always use `status_standardized` for consistent logic.

2. **Hierarchy Snapshots**: When calculating payouts, ALWAYS use `deal_hierarchy_snapshot`, never current positions.

3. **Permissions**: Respect the permission model:
   - Admins: See all agency data
   - Agents: See only self + downlines
   - Check role before returning data

4. **Subscription Tiers**: Feature access is gated by tier:
   - Check `getTierLimits(tier)` before allowing action
   - Expert tier has additional admin-only restrictions

5. **Billing Cycle**: Always check `billing_cycle_end` before checking message limits. Reset if past the end date.

6. **Stripe Integration**:
   - Webhooks are critical for billing
   - Always validate webhook signatures
   - Test with Stripe CLI locally

7. **SMS Restrictions**:
   - Free tier completely blocks SMS (not just limited)
   - Check `tierLimits.smsBlocked` first
   - Check opt-in status before creating messages

8. **Onboarding Flow**: Different paths for admins vs agents. Always check `is_admin` when customizing wizard.

---

## Additional Business Logic Details

### Deal Beneficiaries

**Table:** `deal_beneficiaries`
```
- id (UUID, PK)
- deal_id (FK to deals)
- name
- relationship
- percentage
- created_at
```

**Usage:**
- Optional when posting deals
- Multiple beneficiaries can be added
- Total percentage should equal 100%
- Stored during deal creation (Step 3 of Post Deal flow)

### SMS Message Templates

**Common Templates:**
- Billing reminders: "Hi {client_name}, this is a reminder that your {product_name} premium payment of ${premium_amount} is due in 3 days."
- Birthday messages: "Happy Birthday {client_name}! Wishing you a wonderful year ahead!"
- Lapse notices: "Hi {client_name}, your policy {policy_number} is pending lapse. Please contact us to keep your coverage active."

**Template Variables:**
- `{client_name}` - Client full name
- `{product_name}` - Insurance product name
- `{premium_amount}` - Monthly or annual premium
- `{policy_number}` - Policy identifier
- `{agent_name}` - Writing agent name

### Analytics & Scoreboard

**Scoreboard Features:**
- Weekly production totals
- Monthly production totals
- Top producers ranking
- Individual agent scores
- Deal count vs premium amount

**Score Calculation:**
- Based on total annual premium written
- Filtered by date range
- Shows self + downline production (if tier allows)

**Access Requirements:**
- Pro tier: Full analytics access
- Expert tier: Advanced insights + AI analysis

### Discord Integration

**Webhook Events:**
- New deal posted
- Deal status changed
- Policy lapsed
- Birthday reminders sent

**Message Format:**
- Agent name
- Client name
- Policy details
- Premium amount
- Status change

### White Label Configuration

**Agency Customization:**
- Custom domain (e.g., `agency.agentspace.com`)
- Logo upload (displayed in header)
- Primary color (HSL format for theming)
- Theme mode (light/dark/system)
- Display name (replaces "AgentSpace" branding)

**Implementation:**
- Logo stored in Supabase Storage
- Colors applied via CSS variables
- Theme mode saved in user preferences

---

This documentation covers the complete business logic of AgentSpace. Use this as your reference when developing new features or debugging issues. Welcome to the team!