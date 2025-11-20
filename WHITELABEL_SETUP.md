# White-Label Setup Guide

This guide explains how to set up white-labeling for your agency on AgentSpace.

## Overview

White-labeling allows your agency to use a custom domain (e.g., `agents.youragency.com`) with your own branding (logo, colors, and custom email messages) instead of the default AgentSpace branding.

## What You'll Need

1. A custom domain or subdomain that you control
2. Access to your domain's DNS settings
3. Admin access to your AgentSpace agency settings

## Step-by-Step Setup

### 1. Configure Your Custom Domain in AgentSpace

1. Log in to AgentSpace as an admin
2. Navigate to **Settings** → **Agency Profile**
3. Scroll to the **White-label Domain** section
4. Click the edit button and enter your custom domain (e.g., `agents.youragency.com`)
5. Click **Save Domain**

### 2. Configure DNS Records

After saving your domain in AgentSpace, you need to point your custom domain to the AgentSpace servers.

#### For a Subdomain (Recommended)

If you're using a subdomain like `agents.youragency.com`:

1. Log in to your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)
2. Navigate to DNS settings for your domain
3. Add a new **CNAME record**:
   - **Type**: CNAME
   - **Name**: `agents` (or your chosen subdomain)
   - **Target/Value**: `cname.vercel-dns.com`
   - **TTL**: 3600 (or use default)

#### For an Apex Domain

If you're using an apex domain like `youragency.com`:

1. Log in to your DNS provider
2. Add the following **A record**:
   - **Type**: A
   - **Name**: `@` (or leave blank)
   - **Target/Value**: `76.76.21.21`
   - **TTL**: 3600

3. Add the following **AAAA record**:
   - **Type**: AAAA
   - **Name**: `@` (or leave blank)
   - **Target/Value**: `2606:4700:4700::1111`
   - **TTL**: 3600

### 3. Add Domain to Vercel (Contact Support)

**Important**: After configuring your DNS records, you must contact AgentSpace support to add your custom domain to Vercel's configuration.

Send an email to support@useagentspace.com with:
- Your agency name
- The custom domain you configured (e.g., `agents.youragency.com`)
- Confirmation that you've set up the DNS records

AgentSpace support will:
1. Add your domain to the Vercel project
2. Provision an SSL certificate (this happens automatically)
3. Verify the domain is working correctly

### 4. Verify Setup

Once AgentSpace support confirms the domain has been added:

1. Wait 10-15 minutes for DNS propagation (can take up to 48 hours in rare cases)
2. Visit your custom domain in a web browser
3. You should see the login page with your agency's logo and branding
4. The page should show "Powered by AgentSpace" at the bottom

## Customizing Your Branding

### Logo and Colors

1. Go to **Settings** → **Agency Profile**
2. Upload your agency logo in the **Agency Logo** section
3. Choose your primary brand color in the **Primary Color Scheme** section
4. Select your preferred theme (Light/Dark/System)

### Email Templates

Email invitation and password reset messages use Supabase's default templates. If you need custom email templates with your agency branding, please contact support@useagentspace.com for assistance.

## Troubleshooting

### "Domain not found" error

- **DNS not propagated yet**: Wait 10-15 minutes and try again
- **DNS records incorrect**: Double-check your CNAME/A records match the instructions above
- **Domain not added to Vercel**: Ensure you've contacted AgentSpace support to add your domain

### SSL certificate error

- This is normal immediately after adding the domain
- Vercel automatically provisions SSL certificates (usually takes 1-2 minutes)
- If the error persists after 10 minutes, contact support

### Old domain still showing

- Clear your browser cache
- Try accessing the site in an incognito/private window
- Check DNS propagation using a tool like https://dnschecker.org

## Removing White-Label Domain

If you want to remove your custom domain:

1. Go to **Settings** → **Agency Profile**
2. In the **White-label Domain** section, click edit
3. Clear the domain field and save
4. Contact AgentSpace support to remove the domain from Vercel
5. You can then remove the DNS records from your domain provider

## Support

For assistance with white-label setup:
- Email: support@useagentspace.com
- Include your agency name and custom domain in your message

## Technical Details

### How It Works

- Your custom domain points to AgentSpace's Vercel deployment via DNS
- When users visit your domain, Vercel routes the request to AgentSpace
- AgentSpace detects your custom domain and loads your agency branding
- All authentication and data remain secure with your agency-specific settings
- SSL/TLS encryption is automatically handled by Vercel

### Security

- All traffic uses HTTPS with automatic SSL certificates from Let's Encrypt
- Your agency data remains isolated - only your users can log in via your domain
- DNS changes don't affect your data or existing users
- You can remove white-labeling at any time without data loss
