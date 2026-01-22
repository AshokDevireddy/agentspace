import { createServerClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/get-user-context';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get agency ID from authenticated user, not from headers
    const userContextResult = await getUserContext();
    if (!userContextResult.success) {
      return Response.json({ error: userContextResult.error }, { status: userContextResult.status });
    }
    const { agencyId } = userContextResult.context;

    const supabase = await createServerClient();
    const params = await request.json();

    // Get carriers
    let carriersQuery = supabase
      .from('carriers')
      .select('id, name, display_name, is_active');

    if (params.carrier_id) {
      carriersQuery = carriersQuery.eq('id', params.carrier_id);
    }

    if (params.active_only !== false) {
      carriersQuery = carriersQuery.eq('is_active', true);
    }

    const { data: carriers, error: carriersError } = await carriersQuery;

    if (carriersError) {
      console.error('Error fetching carriers:', carriersError);
      return Response.json({ error: 'Failed to fetch carriers' }, { status: 500 });
    }

    // Get products for the agency
    let productsQuery = supabase
      .from('products')
      .select(`
        id,
        name,
        product_code,
        is_active,
        carrier:carriers(id, name, display_name)
      `)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`);

    if (params.carrier_id) {
      productsQuery = productsQuery.eq('carrier_id', params.carrier_id);
    }

    if (params.active_only !== false) {
      productsQuery = productsQuery.eq('is_active', true);
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Group products by carrier
    const productsByCarrier = products?.reduce((acc: any, product: any) => {
      const carrierId = product.carrier?.id;
      if (!acc[carrierId]) {
        acc[carrierId] = [];
      }
      acc[carrierId].push(product);
      return acc;
    }, {}) || {};

    return Response.json({
      carriers: carriers,
      products: products,
      products_by_carrier: productsByCarrier,
      summary: {
        total_carriers: carriers?.length || 0,
        total_products: products?.length || 0
      }
    });
  } catch (error) {
    console.error('Get carriers and products error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

