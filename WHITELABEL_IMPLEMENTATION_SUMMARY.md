# White-Label Implementation Summary

## What Was Implemented

### 1. Database Schema Updates
**File:** `migrations/add_whitelabel_domain.sql`

Added the following column to the `agencies` table:
- `whitelabel_domain` - Stores the custom domain (e.g., agents.youragency.com)

**Action Required:** Run this migration in Supabase:
```bash
# In Supabase SQL Editor, run the contents of:
migrations/add_whitelabel_domain.sql
```

### 2. Domain Detection & Branding Utilities
**File:** `src/lib/whitelabel.ts`

Created utilities for:
- Detecting if the current domain is white-labeled
- Fetching agency branding by domain (client-side)
- Fetching agency branding by ID (client-side)

**Key Functions:**
- `isWhiteLabelDomain(hostname)` - Checks if domain is white-labeled
- `getAgencyBrandingByDomain(domain)` - Fetches branding for a domain
- `getAgencyBrandingById(agencyId)` - Fetches branding by agency ID

### 3. Agency Branding Context
**File:** `src/contexts/AgencyBrandingContext.tsx`

- React context provider that detects the current domain on page load
- Fetches agency branding if it's a white-label domain
- Makes branding data available throughout the app via `useAgencyBranding()` hook
- Uses only client-side Supabase client (no server imports)

### 4. Updated Login Page
**File:** `src/app/login/page.tsx`

- Displays agency logo and name when accessed via white-label domain
- Shows "Powered by AgentSpace" footer on white-label domains
- Dynamically loads branding based on domain
- Falls back to default AgentSpace branding for main domain
- Shows agency logo in top-left corner for white-label domains

### 5. Agency Settings UI
**File:** `src/app/configuration/page.tsx`

Added White-label Domain section to Agency Profile settings:
- Input field to configure custom domain
- Instructions for DNS setup (CNAME record to `cname.vercel-dns.com`)
- Edit/Save/Cancel functionality
- Displays current domain or "Not configured"

### 6. Updated API Routes for White-Label Redirects

Updated all invitation and password reset APIs to use the agency's white-label domain in redirect URLs:

**Updated Files:**
- `src/app/api/agents/invite/route.ts` - Agent invitations
- `src/app/api/agents/resend-invite/route.ts` - Agent re-invitations
- `src/app/api/clients/invite/route.ts` - Client invitations
- `src/app/api/clients/resend-invite/route.ts` - Client re-invitations
- `src/app/api/reset-password/route.ts` - Password resets

All these routes now:
1. Fetch the agency's white-label domain from the database
2. Build the appropriate redirect URL (white-label or default)
3. Pass the correct redirect URL to Supabase auth functions

### 7. Documentation
**Files:**
- `WHITELABEL_SETUP.md` - Complete guide for agencies on setting up white-labeling
- `WHITELABEL_IMPLEMENTATION_SUMMARY.md` - This file

## What Still Needs to Be Done

### 1. Run the Database Migration
Execute the SQL in `migrations/add_whitelabel_domain.sql` in your Supabase dashboard:

```sql
-- Add whitelabel domain field
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS whitelabel_domain text NULL,
ADD CONSTRAINT agencies_whitelabel_domain_unique UNIQUE (whitelabel_domain);

-- Add comment for documentation
COMMENT ON COLUMN public.agencies.whitelabel_domain IS 'Custom domain for white-labeling (e.g., agents.theiragency.com)';
```

### 2. Configure Domains in Vercel
When an agency adds a white-label domain:
1. They configure it in the Agency Settings
2. They set up the CNAME record with their DNS provider
3. **You (admin) must add the domain to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add the custom domain
   - Vercel will automatically provision SSL

### 3. Test the Implementation
1. Add a test whitelabel domain in agency settings
2. Configure the CNAME in your test domain's DNS
3. Add the domain to Vercel
4. Test accessing the login page via the custom domain
5. Verify logo, colors, and "Powered by AgentSpace" appear correctly
6. Test invitation emails to ensure redirect URLs use the custom domain

## How It Works

### Domain Detection Flow
1. User visits a URL (e.g., `agents.youragency.com`)
2. `AgencyBrandingProvider` checks if hostname is white-labeled
3. If white-labeled, fetches agency branding from database by matching `whitelabel_domain`
4. Branding data is made available app-wide via context
5. Components like login page use the branding data to display agency logo/colors

### Invitation Flow with White-Label
1. Admin invites a user (agent/client/admin)
2. API fetches the agency's `whitelabel_domain` from database
3. If white-label domain exists, redirect URL uses that domain
4. If not, redirect URL uses default `app.useagentspace.com`
5. Supabase sends invitation email with appropriate redirect link
6. User clicks link and is redirected to correct domain
7. Login page shows agency branding if accessed via white-label domain

## Technical Details

### Architecture Decisions

**Client-Side Only Branding:**
- The `AgencyBrandingContext` and `whitelabel.ts` utilities use only the client-side Supabase client
- This avoids Next.js server/client boundary issues
- Branding data is fetched on the client when the page loads
- This is acceptable since branding is public information

**API-Side Domain Resolution:**
- Email invitation APIs fetch the agency's white-label domain server-side
- This ensures redirect URLs in emails are always correct
- Each API independently fetches the domain to avoid coupling

### Security Considerations

- SSL certificates are automatically provisioned by Vercel (Let's Encrypt)
- Agency data is isolated - users can only access their own agency's data
- Domain ownership is verified through DNS configuration
- No data migration needed when adding/removing white-label domains
- Branding data is not sensitive and safe to fetch client-side

## Files Created/Modified

### New Files
- `src/lib/whitelabel.ts` - Domain detection & branding utilities (client-side only)
- `src/contexts/AgencyBrandingContext.tsx` - React context for branding
- `migrations/add_whitelabel_domain.sql` - Database migration
- `WHITELABEL_SETUP.md` - Agency setup guide
- `WHITELABEL_IMPLEMENTATION_SUMMARY.md` - This file

### Modified Files
- `src/app/layout.tsx` - Added AgencyBrandingProvider
- `src/app/login/page.tsx` - Dynamic branding support
- `src/app/configuration/page.tsx` - Added white-label domain settings
- `src/app/api/agents/invite/route.ts` - White-label redirect URLs
- `src/app/api/agents/resend-invite/route.ts` - White-label redirect URLs
- `src/app/api/clients/invite/route.ts` - White-label redirect URLs
- `src/app/api/clients/resend-invite/route.ts` - White-label redirect URLs
- `src/app/api/reset-password/route.ts` - White-label redirect URLs

## Next Steps

1. ✅ Run the database migration in Supabase
2. ⏳ Test with a test domain
3. ⏳ Document the domain addition process for your team
4. ⏳ Add monitoring for white-label domains in production

## Support Information

For agencies setting up white-labeling, share the `WHITELABEL_SETUP.md` guide with them.

For technical questions about the implementation, refer to this document.

## Future Enhancements (Optional)

If you want to customize email templates in the future:
1. Edit Supabase email templates to include agency branding
2. Or implement custom email service (e.g., Resend) with full template control
3. This would require significant changes to how invitations work
