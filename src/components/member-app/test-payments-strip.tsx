/**
 * The TEST PAYMENTS strip (Phase 4, ticket 04; spec, Phase 4 planning
 * decisions → The key decides; story 151l): heads every Member App screen
 * while PayMongo's test key is set, so a Beta Tester knows buying takes no
 * real money. A live key shows none.
 */
export function TestPaymentsStrip() {
  return (
    <p
      role="note"
      aria-label="TEST PAYMENTS"
      className="bg-ayc-navy px-4 py-1.5 text-center font-mono text-[12px] font-bold tracking-wide text-ayc-paper"
    >
      TEST PAYMENTS · no real money
    </p>
  );
}
