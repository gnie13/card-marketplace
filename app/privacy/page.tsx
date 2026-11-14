export const metadata = { title: "Privacy" };

// DRAFT: describes what this codebase actually stores. Have it reviewed before launch.
export default function Privacy() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="mute">Draft. Last updated November 14, 2026.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details.</b> When you sign in with Google we receive your name and email address.</li>
        <li><b>Offers.</b> The card, the amount, any note you write, and the status of each offer you send.</li>
        <li><b>Saved cards and buylist replies.</b> Cards you save, and any card you tell us you have for sale.</li>
        <li><b>Usage.</b> A random ID stored in your browser, the days you visit, and which cards you open. This is not linked to advertising.</li>
      </ul>

      <h2>How we use it</h2>
      <p>We use your name and email to reply to your offers, send updates about offers and saved cards, and complete sales. We use usage counts to see which cards people look at. We do not sell your information.</p>

      <h2>Who processes it</h2>
      <p>Data is stored with Supabase (database and sign-in) and the site is hosted on Vercel. Google handles the sign-in step. Email updates are sent through Resend.</p>

      <h2>Your choices</h2>
      <p>You can withdraw a pending offer at any time. To have your account and offers deleted, write to the contact shown in the site footer.</p>
    </article>
  );
}
