import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { getTierFromPriceId } from '@/lib/subscription-tiers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { priceId, couponCode } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing required field: priceId' },
        { status: 400 }
      );
    }

    // Get tier from price ID
    const tier = getTierFromPriceId(priceId);

    // Check if user is trying to purchase Expert tier
    if (tier === 'expert') {
      // Verify user is admin
      const { data: userCheckData, error: userCheckError } = await supabase
        .from('users')
        .select('is_admin, role')
        .eq('auth_user_id', user.id)
        .single();

      if (userCheckError || !userCheckData) {
        return NextResponse.json(
          { error: 'Failed to verify user permissions' },
          { status: 500 }
        );
      }

      const isAdmin = userCheckData.role === 'admin';

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Expert tier is only available for admin users' },
          { status: 403 }
        );
      }
    }

    // Get user data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, stripe_customer_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let customerId = userData.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: `${userData.first_name} ${userData.last_name}`,
        metadata: {
          supabase_user_id: userData.id,
          auth_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userData.id);
    }

    // Validate and check coupon if provided
    let validatedCoupon = null;
    if (couponCode) {
      try {
        const coupon = await stripe.coupons.retrieve(couponCode);

        if (!coupon.valid) {
          return NextResponse.json(
            { error: 'This coupon is no longer active' },
            { status: 400 }
          );
        }

        // Check if customer has already used ANY coupon (one per lifetime)
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.metadata?.has_used_coupon === 'true') {
          return NextResponse.json(
            { error: 'You have already used your one-time promotional discount' },
            { status: 400 }
          );
        }

        validatedCoupon = couponCode;
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Invalid coupon code' },
          { status: 400 }
        );
      }
    }

    // Create checkout session
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const sessionConfig: any = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/user/profile?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/user/profile?canceled=true`,
      allow_promotion_codes: true, // Enable coupon field in Stripe Checkout
      metadata: {
        user_id: userData.id,
        tier: tier,
      },
      subscription_data: {
        metadata: {
          user_id: userData.id,
          tier: tier,
        },
      },
    };

    // Apply coupon if validated
    if (validatedCoupon) {
      sessionConfig.discounts = [{ coupon: validatedCoupon }];
      // Store that this customer will use this coupon (will be marked as used in webhook)
      sessionConfig.metadata.applied_coupon = validatedCoupon;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
