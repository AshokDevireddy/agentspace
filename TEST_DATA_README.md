# Test Data Scripts

This directory contains SQL scripts to populate and clean up test data for the AgentSpace platform.

## Files

- **`seed_test_data.sql`** - Creates test data (products, agents, clients, deals)
- **`cleanup_test_data.sql`** - Removes all test data
- **`TEST_DATA_README.md`** - This file

## What Gets Created

### Products (20 total)
- Products for 10 major carriers (North American Life, Aetna, Trinity, Aflac, Liberty, Transamerica, Mutual of Omaha, KCL, Americo, SBLI)
- 2 products per carrier with realistic product codes

### Agent Hierarchy (30 agents)
```
Your Account (ID: c3250f05-972c-4b5d-bbf6-91ac00ff5c97)
└── Regional Manager 1 (Michael Rodriguez) - TOP OF TEST HIERARCHY
    ├── Regional Manager 2 (Sarah Thompson)
    │   ├── Team Lead 3 (Emily Davis)
    │   │   └── Agent 9-12
    │   └── Team Lead 4 (James Martinez)
    │       └── Agent 13-16
    ├── Regional Manager 3 (David Chen)
    │   └── Team Lead 5 (Amanda Garcia)
    │       └── Agent 17-22
    ├── Team Lead 1 (Jennifer Williams)
    │   └── Agent 1-4
    └── Team Lead 2 (Robert Johnson)
        └── Agent 5-8
```

**All 30 test agents form ONE complete hierarchy under your account!**

### Clients (80 total)
- Mix of 80 client users with test emails (`test.client1@example.com` through `test.client80@example.com`)

### Deals (350 total)
- Varied policy effective dates spanning the last 365 days
- Different statuses: issued (70%), submitted (15%), in_progress (10%), draft (5%)
- Random lead sources: Referral, Online Lead, Facebook, Cold Call, Walk-in
- Varied premium amounts ($50-$500/month)
- Different billing cycles: monthly, quarterly, semi-annually, annually
- Multiple states: CA, TX, FL, NY, IL, PA, OH, GA, NC, AZ
- 50% of deals linked to client users

## How to Use

### Step 1: Seed Test Data

Run the seed script in your Supabase SQL editor or via CLI:

```bash
# Via Supabase CLI
supabase db execute < seed_test_data.sql

# Or copy/paste the contents into Supabase SQL Editor
```

**That's it!** The hierarchy is automatically set up with all test agents reporting up to your account (ID: `c3250f05-972c-4b5d-bbf6-91ac00ff5c97`).

### Step 2: Test Your Application

Now you have:
- ✅ Complete agent hierarchy for testing org charts, commissions, and downlines
- ✅ 350 deals spread across the year for scoreboard calculations
- ✅ Multiple carriers and products for realistic scenarios
- ✅ Clients for testing client-facing features

### Step 3: Clean Up When Done

When you're finished testing and want to remove all test data:

```bash
# Via Supabase CLI
supabase db execute < cleanup_test_data.sql

# Or copy/paste the contents into Supabase SQL Editor
```

The cleanup script will:
1. Delete all test deals (350 records)
2. Delete all test clients (80 records)
3. Delete all test agents (30 records)
4. Delete all test products (20 records)

## Important Notes

⚠️ **Prerequisites**
- Make sure you have the "AgentSpace" agency in your `agencies` table (with code 'agentspace')
- The script automatically fetches carrier IDs from your `carriers` table by name
- Required carriers: North American Life, Aetna, Trinity Life / Family Benefit Life, Aflac, Liberty Bankers Life (LBL), Transamerica, Mutual of Omaha, Kansas City Life (KCL), Americo, SBLI

⚠️ **Test Data Identification**
- All test users have emails with pattern: `test.*@agentspace.test` or `test.client*@example.com`
- All test deals have policy numbers: `POL-TEST-######`
- All test products have codes starting with carrier abbreviations (NAL-, AETNA-, etc.)

⚠️ **No Auth Users**
- Test users are NOT linked to Supabase Auth (`auth_user_id` is NULL)
- This means you cannot log in as these users
- They exist only for data relationships and UI testing

⚠️ **Foreign Key Safety**
- The cleanup script deletes in the correct order to respect foreign key constraints
- Deals → Clients → Agents → Products

⚠️ **Date Distribution**
- Deals are evenly distributed across the last 365 days
- This allows for realistic scoreboard calculations for:
  - Monthly production
  - Quarterly goals
  - Year-to-date metrics
  - Trend analysis

## Testing Scenarios

With this test data, you can test:

1. **Scoreboard Calculations**
   - Monthly/quarterly/annual production
   - Agent rankings
   - Team performance

2. **Agent Hierarchy**
   - Downline viewing
   - Commission rollups
   - Org chart visualization

3. **Filtering & Search**
   - Filter deals by date range
   - Search by agent, carrier, status
   - Multi-parameter filtering

4. **Analytics**
   - Production trends over time
   - Carrier distribution
   - Lead source performance
   - State-wise analysis

5. **UI Performance**
   - Table pagination with 350+ records
   - Large dropdown lists
   - Chart rendering with substantial data

## Quick Reference

```sql
-- Check how many test records exist
SELECT
    (SELECT COUNT(*) FROM users WHERE email LIKE 'test.%@agentspace.test') as agents,
    (SELECT COUNT(*) FROM users WHERE email LIKE 'test.client%@example.com') as clients,
    (SELECT COUNT(*) FROM deals WHERE policy_number LIKE 'POL-TEST-%') as deals,
    (SELECT COUNT(*) FROM products WHERE product_code LIKE '%-%-0%') as products;

-- View the test agent hierarchy
SELECT id, email, first_name, last_name, upline_id, perm_level
FROM users
WHERE email LIKE 'test.%@agentspace.test'
ORDER BY
  CASE
    WHEN email = 'test.rm1@agentspace.test' THEN 1
    WHEN email LIKE 'test.rm%' THEN 2
    WHEN email LIKE 'test.tl%' THEN 3
    ELSE 4
  END,
  email;

-- View deal distribution by month
SELECT
    DATE_TRUNC('month', policy_effective_date) as month,
    COUNT(*) as deal_count,
    SUM(annual_premium) as total_premium
FROM deals
WHERE policy_number LIKE 'POL-TEST-%'
GROUP BY DATE_TRUNC('month', policy_effective_date)
ORDER BY month DESC;
```

## Troubleshooting

**Q: I get "invalid input syntax for type uuid" errors**
- A: This has been fixed! The script now automatically fetches carrier and agency IDs from your database instead of hardcoding them.

**Q: I get "AgentSpace agency not found" error**
- A: Make sure you have an agency with code 'agentspace' in your agencies table.

**Q: I get "One or more carriers not found" error**
- A: The script requires these specific carriers in your database: North American Life, Aetna, Trinity Life / Family Benefit Life, Aflac, Liberty Bankers Life (LBL), Transamerica, Mutual of Omaha, Kansas City Life (KCL), Americo, SBLI. Make sure the names match exactly.

**Q: I get foreign key constraint errors when seeding**
- A: Make sure you have existing carriers in your database. The script automatically looks them up by name.

**Q: Some deals aren't showing up in my UI**
- A: Check that your UI filters aren't excluding test data (e.g., date range filters)

**Q: Cleanup script didn't delete everything**
- A: Run the script again. If issues persist, check for foreign key constraints from other tables we didn't anticipate.

**Q: How do I add more test data?**
- A: You can run the seed script multiple times, but you'll get duplicate email errors. Instead, modify the script to use different email patterns or increment the numbers.

