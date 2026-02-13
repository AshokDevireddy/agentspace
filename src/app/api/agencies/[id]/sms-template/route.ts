import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_SMS_TEMPLATES } from '@/lib/sms-template-helpers';
import { authenticateRoute, isAuthError } from '@/lib/auth/route-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRoute();
    if (isAuthError(authResult)) return authResult;
    const { user } = authResult;

    const agencyId = params.id;
    if (user.agencyId !== agencyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Fetch agency SMS welcome settings
    const { data: agency, error } = await admin
      .from('agencies')
      .select('messaging_enabled, sms_welcome_enabled, sms_welcome_template')
      .eq('id', agencyId)
      .single();

    if (error || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      );
    }

    // Choose template based on sms_welcome_enabled
    // If enabled: use custom template or default
    // If disabled: use default template
    const template = agency.sms_welcome_enabled
      ? (agency.sms_welcome_template || DEFAULT_SMS_TEMPLATES.welcome)
      : DEFAULT_SMS_TEMPLATES.welcome;

    return NextResponse.json({
      template,
      enabled: agency.sms_welcome_enabled,
      messagingEnabled: agency.messaging_enabled
    });

  } catch (error) {
    console.error('Error fetching SMS template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMS template' },
      { status: 500 }
    );
  }
}
