import Link from "next/link";

export const metadata = { title: "Terms of use" };

// DRAFT: a plain-language starting point. Have it reviewed before you rely on it,
// and fill in the business name and confirm the pickup and return terms.
export default function Terms() {
  return (
    <article className="legal">
      <h1>Terms of use</h1>
      <p className="mute">Draft. Last updated November 14, 2026.</p>

      <h2>Using this site</h2>
      <p>This site lists trading cards we have for sale and lets signed-in visitors send offers. You must be at least 18, or have a parent or guardian&apos;s permission, to send an offer.</p>

      <h2>Accounts</h2>
      <p>You sign in with a Google account. You are responsible for activity under your account. We may suspend accounts used for fraud, spam, or abuse.</p>

      <h2>Offers and sales</h2>
      <p>Offers follow the rules on the <Link href="/guide">condition guide and offer rules</Link> page. No payment is collected through this site. A sale is complete only when the seller confirms payment.</p>

      <h2>Listings and prices</h2>
      <p>We describe each card&apos;s condition as accurately as we can. Market prices come from a third party and are shown for reference only. We may correct listing errors and decline any offer.</p>

      <h2>Pickup, payment and returns</h2>
      <p>All sales are completed in person in the Illinois Quad Cities area. We do not ship. Prices include sales tax. Payment is made at the handoff, after you have had the chance to inspect the card. Sales are final once the card has been inspected, paid for, and handed over.</p>

      <h2>Trademarks</h2>
      <p>Card and game names belong to their owners. This site is an independent reseller and is not affiliated with, sponsored by, or endorsed by any card publisher.</p>

      <h2>Liability</h2>
      <p>The site is provided as is. To the extent the law allows, our liability for any sale is limited to the amount you paid for the card.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent to the contact shown in the site footer.</p>
    </article>
  );
}
