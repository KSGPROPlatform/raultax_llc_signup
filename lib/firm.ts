// The firm's service terms and receiving bank account — shown to every client
// (this is where the preparation fee is paid, so the numbers appear IN FULL).
// Pure data, safe for client and server imports.
//
// >>> TODO (Doane): replace the placeholder bank details with the firm's real
// >>> account. Everything else updates automatically.

export const PREPARATION_FEE_USD = 500; // per declaration (per tax year)

export const FIRM_BANK = {
  accountName: "KSG PRO LLC",
  bankName: "Your Bank Name", // TODO
  routingNumber: "000000000", // TODO
  accountNumber: "0000000000", // TODO
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const FEE_LABEL = usd(PREPARATION_FEE_USD); // "$500"

// What actually lands in the client's pocket after the preparation fee.
// Returns null when the refund doesn't cover the fee (caller shows a note
// instead of a negative number).
export function netRefundAfterFee(refund: number): number | null {
  const net = refund - PREPARATION_FEE_USD;
  return net > 0 ? net : null;
}
