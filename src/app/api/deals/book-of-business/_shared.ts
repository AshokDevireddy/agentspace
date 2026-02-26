/**
 * Shared filter-parsing logic for book-of-business routes.
 * Used by both the listing route and the summary route.
 */
export function buildBookFilters(searchParams: URLSearchParams) {
  const agentId = searchParams.get("agent_id");
  const carrierId = searchParams.get("carrier_id");
  const productId = searchParams.get("product_id");
  const clientId = searchParams.get("client_id");
  const policyNumber = searchParams.get("policy_number");
  const statusMode = searchParams.get("status_mode");
  const statusStandardized = searchParams.get("status_standardized");
  const billingCycle = searchParams.get("billing_cycle");
  const leadSource = searchParams.get("lead_source");
  const clientPhone = searchParams.get("client_phone");
  const effectiveDateStart = searchParams.get("effective_date_start");
  const effectiveDateEnd = searchParams.get("effective_date_end");
  const submittedDateStart = searchParams.get("submitted_date_start");
  const submittedDateEnd = searchParams.get("submitted_date_end");

  return {
    agent_id: agentId && agentId !== "all" ? agentId : null,
    carrier_id: carrierId && carrierId !== "all" ? carrierId : null,
    product_id: productId && productId !== "all" ? productId : null,
    client_id: clientId && clientId !== "all" ? clientId : null,
    policy_number: policyNumber && policyNumber !== "all"
      ? policyNumber.trim()
      : null,
    status_mode: statusMode || null,
    status_standardized: statusStandardized && statusStandardized !== "all"
      ? statusStandardized
      : null,
    billing_cycle: billingCycle && billingCycle !== "all"
      ? billingCycle
      : null,
    lead_source: leadSource && leadSource !== "all" ? leadSource : null,
    client_phone: clientPhone ? clientPhone.replace(/\D/g, '') : null,
    effective_date_start: effectiveDateStart || null,
    effective_date_end: effectiveDateEnd || null,
    submitted_date_start: submittedDateStart || null,
    submitted_date_end: submittedDateEnd || null,
  };
}
