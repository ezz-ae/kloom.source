// ONE PASS, MORE THAN ONE WAY TO PAY.
//
// The pass is sold by Ziina (hosted card checkout) and, now, by crypto. Those two
// are nothing alike underneath — one is a synchronous intent you can poll by id,
// the other is an on-chain payment that arrives whenever it arrives and tells you
// about it through a signed callback — but the thing being SOLD is identical, and
// so is everything that makes selling it safe:
//
//   • the pass is minted only after the provider says the money arrived
//   • the amount is checked, so a cheaper payment can't be replayed into a pass
//   • the 90 days are anchored to PURCHASE time, signed, so re-claiming can't
//     roll the window forward into a lifetime pass
//
// Those three live ONCE, in /api/airraw-pro, above this interface. A gateway's
// only job is to answer "did this specific person actually pay, and how much" —
// it never decides what that entitles them to. Adding a third provider should
// mean writing the two functions below and nothing else; if a new provider ever
// needs a fourth rule bolted on, that rule belongs above this line, not inside it.

/** What a buyer needs to go and pay: an id we can ask about later, and a URL. */
export interface Checkout {
  /** OUR handle on this sale. Whatever the provider calls it, we key off this. */
  id: string
  /** Where to send the buyer. */
  url: string
  /**
   * True when the provider is in sandbox mode and no money actually moves. Shown
   * at checkout because "is this real yet?" is the one launch question that a
   * dashboard setting can silently get wrong.
   */
  test?: boolean
}

/**
 * What the provider says about a sale.
 *
 * `usd` is what was ACTUALLY paid, not what we asked for — the caller compares it
 * against the price, and the difference between those two numbers is the whole
 * point of returning it. A crypto payment can land short (the buyer sends less
 * than quoted, or fees eat the difference) and it must not buy a full pass.
 */
export interface PayStatus {
  paid: boolean
  /** The provider's own word for the state, passed through for the client + logs. */
  status: string
  /** Actually paid, in USD, when the provider tells us. */
  usd?: number
}

export interface CheckoutArgs {
  usd: number
  description: string
  successUrl: string
  cancelUrl: string
  failureUrl?: string
  /** Where the provider should call us back, for the ones that do. */
  ipnUrl?: string
}

export interface Gateway {
  /** Stable key: what the client asks for, what the logs and the tracker say. */
  key: string
  /** Configured AND able to complete a sale end to end — see each implementation. */
  ready(): boolean
  createCheckout(a: CheckoutArgs): Promise<Checkout>
  /** Never throws for "not paid" — that is a status, not an error. */
  getStatus(id: string): Promise<PayStatus>
}
