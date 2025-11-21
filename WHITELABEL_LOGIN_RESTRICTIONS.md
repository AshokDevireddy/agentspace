# White-Label Login Restrictions

## Overview
The white-label system now enforces strict domain-based login restrictions to ensure users can only log in through their agency's designated domain.

## Login Rules

### Rule 1: White-Label Agency Users MUST Use Their Custom Domain
**Who:** Users whose agency has a `whitelabel_domain` configured
**Where they can log in:** ONLY their agency's custom domain (e.g., `nonstopcrm.com`)
**Where they CANNOT log in:** `app.useagentspace.com` (default domain)

**Example:**
- NonStop CRM has `whitelabel_domain = 'nonstopcrm.com'`
- NonStop CRM users can ONLY log in at `https://nonstopcrm.com`
- If they try to log in at `https://app.useagentspace.com`, they get: "No account found with these credentials"

### Rule 2: Non-White-Label Agency Users Can Use Default Domain
**Who:** Users whose agency does NOT have a `whitelabel_domain` configured
**Where they can log in:** `app.useagentspace.com` (default domain)
**Where they CANNOT log in:** Other agencies' white-label domains

**Example:**
- Generic Agency has `whitelabel_domain = null` (no white-labeling)
- Generic Agency users can log in at `https://app.useagentspace.com`
- They cannot log in at `https://nonstopcrm.com` (different agency)

### Rule 3: Cross-Agency Login Prevention
**Who:** All users
**Restriction:** Cannot log in through another agency's white-label domain

**Example:**
- User A belongs to NonStop CRM (`nonstopcrm.com`)
- User B belongs to Test Agency (`testagency.com`)
- User A cannot log in at `testagency.com`
- User B cannot log in at `nonstopcrm.com`

## Implementation Details

### Code Location
[src/app/login/page.tsx:160-190](src/app/login/page.tsx#L160-L190)

### Login Flow

```typescript
1. User enters credentials
2. Supabase authenticates email/password
3. Fetch user's profile (role, status, agency_id)
4. Fetch user's agency info (whitelabel_domain)

5. Check #1: If on white-label domain
   - Verify user's agency_id matches the domain's agency
   - If mismatch → Sign out + Error

6. Check #2: If on default domain (app.useagentspace.com)
   - Check if user's agency has a whitelabel_domain
   - If yes → Sign out + Error (must use their custom domain)
   - If no → Allow login

7. Continue with other checks (status, role, etc.)
8. Redirect to dashboard
```

## Error Messages

All domain mismatch errors show the same generic message:
```
"No account found with these credentials"
```

This is intentional for security reasons:
- Prevents email enumeration
- Prevents agency membership disclosure
- Doesn't reveal why login failed

## Test Scenarios

### Scenario 1: White-Label User on Correct Domain ✅
- **User:** NonStop CRM agent
- **Domain:** `nonstopcrm.com`
- **Agency whitelabel_domain:** `'nonstopcrm.com'`
- **Result:** Login successful

### Scenario 2: White-Label User on Default Domain ❌
- **User:** NonStop CRM agent
- **Domain:** `app.useagentspace.com`
- **Agency whitelabel_domain:** `'nonstopcrm.com'`
- **Result:** Error - "No account found with these credentials"

### Scenario 3: White-Label User on Different White-Label Domain ❌
- **User:** NonStop CRM agent
- **Domain:** `testagency.com`
- **Agency whitelabel_domain:** `'nonstopcrm.com'`
- **Result:** Error - "No account found with these credentials"

### Scenario 4: Non-White-Label User on Default Domain ✅
- **User:** Generic Agency agent
- **Domain:** `app.useagentspace.com`
- **Agency whitelabel_domain:** `null`
- **Result:** Login successful

### Scenario 5: Non-White-Label User on White-Label Domain ❌
- **User:** Generic Agency agent
- **Domain:** `nonstopcrm.com`
- **Agency whitelabel_domain:** `null`
- **Result:** Error - "No account found with these credentials"

## Database Queries

### Check if Agency is White-Labeled
```sql
SELECT whitelabel_domain
FROM agencies
WHERE id = '<user_agency_id>';
```

If `whitelabel_domain IS NOT NULL` → Agency is white-labeled

### Check if Domain Matches Agency
```sql
SELECT id
FROM agencies
WHERE whitelabel_domain = '<current_domain>';
```

If result matches user's agency_id → Can log in

## Security Benefits

1. **Agency Isolation**: Each white-labeled agency is completely isolated
2. **Brand Consistency**: Users always see their agency's branding
3. **No Confusion**: Users can't accidentally log in through wrong domain
4. **Professional**: Each agency has complete ownership of their domain experience

## Edge Cases

### Case 1: Agency Adds White-Label Domain
**Before:** Agency has no white-label domain, users log in at app.useagentspace.com
**After:** Agency configures white-label domain
**Impact:** Existing users CANNOT log in at app.useagentspace.com anymore
**Solution:** Users must use the new white-label domain

**Recommendation:** When enabling white-labeling, notify all users of the new login URL

### Case 2: Agency Removes White-Label Domain
**Before:** Users log in at custom domain
**After:** Agency removes white-label domain
**Impact:** Users CAN log in at app.useagentspace.com
**Solution:** Users can use default domain

### Case 3: Agency Changes White-Label Domain
**Before:** Users log in at `oldcomain.com`
**After:** Agency changes to `newdomain.com`
**Impact:** Old domain stops working, must use new domain
**Solution:**
1. Update `whitelabel_domain` in database
2. Configure new domain in Vercel
3. Notify all users of the new URL

## Monitoring

### Check Login Errors
Look for patterns of "No account found" errors that might indicate:
- Users trying to log in through wrong domain
- Agency recently enabled white-labeling
- DNS or domain configuration issues

### Verify Agency Configuration
```sql
-- List all white-labeled agencies
SELECT
  name,
  whitelabel_domain,
  is_active
FROM agencies
WHERE whitelabel_domain IS NOT NULL
ORDER BY name;
```

### Check User's Login Domain
```sql
-- Find which domain a user should use
SELECT
  u.email,
  u.first_name,
  u.last_name,
  a.name as agency_name,
  a.whitelabel_domain,
  CASE
    WHEN a.whitelabel_domain IS NOT NULL THEN 'https://' || a.whitelabel_domain
    ELSE 'https://app.useagentspace.com'
  END as login_url
FROM users u
JOIN agencies a ON a.id = u.agency_id
WHERE u.email = 'user@example.com';
```

## Support Scenarios

### User Can't Log In
1. **Check:** Which domain are they trying?
2. **Check:** What domain should they use?
3. **Run query:**
   ```sql
   SELECT
     u.email,
     a.whitelabel_domain
   FROM users u
   JOIN agencies a ON a.id = u.agency_id
   WHERE u.email = 'user@example.com';
   ```
4. **If whitelabel_domain is not null:** Direct them to that domain
5. **If whitelabel_domain is null:** Direct them to app.useagentspace.com

### Agency Wants to Enable White-Labeling
1. Agency configures domain in Settings → Agency Profile
2. Agency sets up DNS (CNAME to cname.vercel-dns.com)
3. Admin adds domain to Vercel
4. **Important:** Notify all agency users of the new login URL
5. Test login at new domain
6. Old app.useagentspace.com login will immediately stop working for their users

## Related Files

- Login logic: [src/app/login/page.tsx](src/app/login/page.tsx)
- Domain detection: [src/lib/whitelabel.ts](src/lib/whitelabel.ts)
- Branding context: [src/contexts/AgencyBrandingContext.tsx](src/contexts/AgencyBrandingContext.tsx)
- Agency settings: [src/app/configuration/page.tsx](src/app/configuration/page.tsx)

## Summary

✅ **White-labeled agency users:** Must use their custom domain
✅ **Non-white-labeled users:** Use app.useagentspace.com
✅ **Cross-agency prevention:** Cannot log in to other agencies
✅ **Security:** Generic error messages prevent information disclosure
✅ **Enforcement:** Automatic sign-out if domain mismatch detected
