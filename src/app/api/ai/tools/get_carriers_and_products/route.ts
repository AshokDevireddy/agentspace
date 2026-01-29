import { getSession } from '@/lib/session';
import { getApiBaseUrl } from '@/lib/api-config';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session.accessToken;
    const apiUrl = getApiBaseUrl();
    const params = await request.json();

    // Fetch carriers from Django
    const carriersResponse = await fetch(
      `${apiUrl}/api/carriers/`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let carriers: any[] = [];
    if (carriersResponse.ok) {
      carriers = await carriersResponse.json();

      // Filter by carrier_id if specified
      if (params.carrier_id) {
        carriers = carriers.filter((c: any) => c.id === params.carrier_id);
      }

      // Filter by active status (default to active only)
      if (params.active_only !== false) {
        carriers = carriers.filter((c: any) => c.is_active);
      }
    } else {
      console.error('Error fetching carriers:', await carriersResponse.text());
    }

    // Fetch all products for agency from Django
    const productsResponse = await fetch(
      `${apiUrl}/api/products/all`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    let products: any[] = [];
    if (productsResponse.ok) {
      products = await productsResponse.json();

      // Transform to expected format with nested carrier
      products = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        product_code: p.product_code,
        is_active: p.is_active,
        carrier: {
          id: p.carrier_id,
          name: p.carrier_name,
          display_name: p.carrier_display_name
        }
      }));

      // Filter by carrier_id if specified
      if (params.carrier_id) {
        products = products.filter((p: any) => p.carrier?.id === params.carrier_id);
      }

      // Filter by active status (default to active only)
      if (params.active_only !== false) {
        products = products.filter((p: any) => p.is_active);
      }
    } else {
      console.error('Error fetching products:', await productsResponse.text());
    }

    // Group products by carrier
    const productsByCarrier = products.reduce((acc: any, product: any) => {
      const carrierId = product.carrier?.id;
      if (carrierId) {
        if (!acc[carrierId]) {
          acc[carrierId] = [];
        }
        acc[carrierId].push(product);
      }
      return acc;
    }, {});

    return Response.json({
      carriers: carriers,
      products: products,
      products_by_carrier: productsByCarrier,
      summary: {
        total_carriers: carriers.length,
        total_products: products.length
      }
    });
  } catch (error) {
    console.error('Get carriers and products error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

