/**
 * Where PayMongo's hosted checkout lives (Phase 4, ticket 04;
 * https://docs.paymongo.com/reference/checkout-session-resource →
 * checkout_url): the only page off this site Pay sends a Member to. The
 * client refuses any other checkout address, and the CSP's form-action lets
 * Pay's redirect reach this one origin.
 */
export const PAYMONGO_CHECKOUT_ORIGIN = "https://checkout.paymongo.com";
