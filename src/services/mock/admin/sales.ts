import { isPassActive } from "@/lib/member-app/access";
import { awaitsRefund } from "@/lib/payments/order-ledger";
import { sampleOrderRecord } from "@/services/mock/admin/orders";
import { getSampleStore } from "@/services/mock/sample-store";
import { salesCalls, type SalesStore } from "@/services/sales.core";

// The sample arm of the Overview's sales (Phase 4, ticket 11): the shared
// calls (src/services/sales.core.ts) over the in-memory sample store. A
// pass counts once its holder has a Member record, as the Users list counts
// Members; they're Staff while their email is on the staff list.

const sampleSalesStore: SalesStore = {
  async listSalesOrders(since) {
    const after = (instant: string | null) => instant !== null && new Date(instant) >= since;
    return structuredClone(
      getSampleStore()
        .orders.filter((order) => order.livemode)
        .map(sampleOrderRecord)
        .filter(
          ({ order, invoice, refunds }) =>
            after(order.paidAt) ||
            order.status === "pending" ||
            refunds.some((refund) => after(refund.refundedAt)) ||
            (invoice !== null && invoice.sentAt === null) ||
            awaitsRefund(order),
        ),
    );
  },
  async listActivePasses(now) {
    const { accessPasses, members, staff } = getSampleStore();
    const staffEmails = new Set(staff.map(({ email }) => email));
    return accessPasses.flatMap(({ userId, endsAt }) => {
      const member = members.find((candidate) => candidate.userId === userId);
      if (!member || !isPassActive(endsAt, now)) return [];
      return [{ userId, endsAt, staff: staffEmails.has(member.email) }];
    });
  },
};

export const { salesOverview, getPaidToday } = salesCalls(sampleSalesStore);
