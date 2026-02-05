# Linked Agents Implementation Guide

## Overview

This implementation adds support for "linked agents" - a special relationship where Agent A can be linked to Agent B, causing:
1. Agent A becomes invisible in the UI (hierarchy, tables, dropdowns)
2. All of Agent A's deals appear as if they belong to Agent B
3. Agent A cannot have uplines or be anyone's upline
4. Agent A cannot log in (no auth)
5. Deals remain assigned to Agent A in the database, but are aggregated to Agent B

## Database Changes

### New Column: `users.linked_to_agent_id`
- **Type**: `UUID` (references `users.id`)
- **Nullable**: Yes
- **Purpose**: Points to the agent this account is linked to

### Constraints Added

1. **`chk_linked_agent_no_upline`**: Linked agents cannot have an upline
   ```sql
   CHECK (
     (linked_to_agent_id IS NULL) OR
     (linked_to_agent_id IS NOT NULL AND upline_id IS NULL)
   )
   ```

2. **`chk_linked_agent_no_auth`**: Linked agents cannot log in
   ```sql
   CHECK (
     (linked_to_agent_id IS NULL) OR
     (linked_to_agent_id IS NOT NULL AND auth_user_id IS NULL)
   )
   ```

3. **`chk_linked_agent_not_self`**: Agents cannot be linked to themselves
   ```sql
   CHECK (
     (linked_to_agent_id IS NULL) OR
     (linked_to_agent_id IS NOT NULL AND id != linked_to_agent_id)
   )
   ```

### Index Added
```sql
CREATE INDEX idx_users_linked_to_agent_id
ON users(linked_to_agent_id)
WHERE linked_to_agent_id IS NOT NULL;
```

## New Helper Function

### `get_effective_agent_ids(p_agent_id UUID) RETURNS UUID[]`

Returns an array containing:
- The input agent ID
- All agent IDs that are linked to the input agent

**Example**:
- Agent B (ID: `123`)
- Agent A (ID: `456`) has `linked_to_agent_id = '123'`
- `get_effective_agent_ids('123')` returns `['123', '456']`

**Usage**: When fetching deals for Agent B, use this function to get deals from both B and A.

## Modified RPC Functions

### 1. `get_agent_downline`
**Change**: Excludes linked agents from hierarchy traversal
```sql
WHERE u.linked_to_agent_id IS NULL
```

### 2. `get_agents_hierarchy_nodes`
**Change**: Excludes linked agents from graph/tree view
```sql
WHERE u.role <> 'client'
  AND u.linked_to_agent_id IS NULL
```

### 3. `get_agents_table`
**Change**: Excludes linked agents from table view
```sql
WHERE u.role <> 'client'
  AND u.linked_to_agent_id IS NULL
```

### 4. `get_agent_options`
**Change**: Excludes linked agents from dropdown filters
```sql
WHERE u.role <> 'client'
  AND u.linked_to_agent_id IS NULL
```

### 5. `get_book_of_business`
**Change**: Includes linked agent deals when fetching for an agent

**Key modifications**:
- **Self view**: Uses `get_effective_agent_ids(n.id)` to include linked agents' deals
- **Downlines view**: For each downline, gets their effective agent IDs and includes those deals

```sql
-- Self view
SELECT d.id AS deal_id
FROM normalized n
JOIN deals d ON d.agent_id = ANY(public.get_effective_agent_ids(n.id))
WHERE n.scope_view = 'self'

-- Downlines view
SELECT DISTINCT d.id AS deal_id
FROM normalized n
JOIN LATERAL get_agent_downline(n.id) dl ON TRUE
CROSS JOIN LATERAL UNNEST(public.get_effective_agent_ids(dl.id)) AS effective_id
JOIN deals d ON d.agent_id = effective_id
WHERE n.scope_view = 'downlines'
```

## Migration Files Created

All migration files are in `/supabase/migrations/`:

1. **`add_linked_agent_support.sql`**
   - Adds `linked_to_agent_id` column
   - Adds all constraints
   - Creates `get_effective_agent_ids` helper function

2. **`update_get_agent_downline_exclude_linked.sql`**
   - Updates hierarchy traversal to exclude linked agents

3. **`update_get_agents_hierarchy_nodes_exclude_linked.sql`**
   - Updates graph view to exclude linked agents

4. **`update_get_agents_table_exclude_linked.sql`**
   - Updates table view to exclude linked agents

5. **`update_get_agent_options_exclude_linked.sql`**
   - Updates dropdowns to exclude linked agents

6. **`update_get_book_of_business_include_linked_deals.sql`**
   - Updates book of business to include linked agent deals

## Running the Migrations

**IMPORTANT**: Do NOT run migrations without explicit consent from the user.

When ready to deploy, run migrations in Supabase:

```bash
# If using Supabase CLI
supabase db push

# Or apply each migration manually in Supabase SQL Editor
```

## How to Create a Linked Agent

Once migrations are run, you can link Agent A to Agent B manually in Supabase:

```sql
-- Link Agent A (id: 'agent-a-uuid') to Agent B (id: 'agent-b-uuid')
UPDATE public.users
SET linked_to_agent_id = 'agent-b-uuid',
    upline_id = NULL,              -- Required by constraint
    auth_user_id = NULL            -- Required by constraint
WHERE id = 'agent-a-uuid';
```

**Validation**: The constraints will automatically ensure:
- Agent A has no upline
- Agent A has no auth (cannot login)
- Agent A is not linked to itself

## How to Unlink an Agent

```sql
-- Unlink Agent A
UPDATE public.users
SET linked_to_agent_id = NULL
WHERE id = 'agent-a-uuid';

-- Note: You may want to restore upline_id and auth_user_id manually if needed
```

## Testing the Implementation

### Test Case 1: Linked Agent is Hidden
1. Create two agents: Agent A and Agent B
2. Link Agent A to Agent B
3. Verify Agent A does not appear in:
   - Agents table view
   - Hierarchy graph view
   - Pending positions view
   - Dropdown filters (upline selects, etc.)

### Test Case 2: Deals Roll Up
1. Agent A has 5 deals with $10K annual premium each
2. Agent B has 3 deals with $5K annual premium each
3. Link Agent A to Agent B
4. View Agent B's book of business:
   - Should show 8 deals total
   - Total production should be $65K ($50K from A + $15K from B)

### Test Case 3: Downlines View
1. Agent C has Agent B as upline
2. Agent B has 3 deals, Agent A (linked to B) has 5 deals
3. View Agent C's downlines production:
   - Should see Agent B with 8 deals total
   - Agent A should not appear in hierarchy

### Test Case 4: Cannot Create Invalid Links
Try to create these invalid scenarios (should fail):
```sql
-- Cannot link agent with upline (should fail)
UPDATE users SET linked_to_agent_id = 'some-uuid' WHERE id = 'agent-with-upline';

-- Cannot link agent with auth (should fail)
UPDATE users SET linked_to_agent_id = 'some-uuid' WHERE id = 'agent-with-auth';

-- Cannot link to self (should fail)
UPDATE users SET linked_to_agent_id = id WHERE id = 'some-uuid';
```

## Performance Considerations

1. **Index on `linked_to_agent_id`**: Ensures fast lookups when finding linked agents
2. **Helper function is efficient**: Single query to aggregate agent IDs
3. **Minimal overhead**: Only adds one additional check (`WHERE linked_to_agent_id IS NULL`) to most queries

## Frontend Impact

**No frontend changes required!** The implementation is entirely server-side:
- Linked agents automatically disappear from all views
- Linked agents' deals automatically appear under the linked-to agent
- All existing components continue to work as-is

## Rollback Plan

If issues occur, you can rollback by:

1. **Remove all links first**:
   ```sql
   UPDATE public.users SET linked_to_agent_id = NULL WHERE linked_to_agent_id IS NOT NULL;
   ```

2. **Drop constraints**:
   ```sql
   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_linked_agent_no_upline;
   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_linked_agent_no_auth;
   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_linked_agent_not_self;
   ```

3. **Drop column**:
   ```sql
   ALTER TABLE public.users DROP COLUMN IF EXISTS linked_to_agent_id;
   ```

4. **Restore old RPC functions** (run the previous versions from backups)

## Future Enhancements

Potential improvements for the future:

1. **UI for Creating Links**: Add admin interface to link/unlink agents
2. **Link History**: Track when agents were linked/unlinked
3. **Bulk Linking**: Support linking multiple agents at once
4. **Link Validation**: Check for circular dependencies (though current constraints prevent this)
5. **Analytics Updates**: Ensure analytics RPC functions also respect linked agents

## Questions or Issues?

If you encounter any issues:
1. Check constraint violations in Supabase logs
2. Verify linked agents have `upline_id = NULL` and `auth_user_id = NULL`
3. Test queries manually in Supabase SQL Editor
4. Review the specific RPC function that's causing issues

---

## Summary

This implementation provides a clean, performant way to "merge" agent accounts without losing historical data. The linked agent's deals remain in the database under their original agent_id, but appear aggregated under the linked-to agent in all UI views and reports.
