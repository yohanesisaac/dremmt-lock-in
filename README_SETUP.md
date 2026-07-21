# Dremmt Lock-In — Setup

A responsive pilot website: a friend commitment + reward system. Pick a friend,
a restaurant, and a day; get the friend to accept one proposed window; unlock
at least $6 toward that outing (up to three completed plans per calendar month
after a 14-day free trial with one rewarded plan); monitor everything from a
private admin dashboard and text reminders manually.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Stripe ·
Zod.

---

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Go to <https://supabase.com>, create a project.
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (anon) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (service role / `service_role`) → `SUPABASE_SECRET_KEY`
     - Keep this server-side only. Never expose it to the browser.

## 3. Run the database schema

1. Open **SQL Editor** in Supabase.
2. Paste the full contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it.
3. This creates the `members` and `runs` tables, constraints, indexes, the
   `updated_at` trigger, the `reserve_reward` function (trial + monthly
   allowance), and enables Row Level Security (no policies, so only the secret
   key can read/write).

> **Already have a Dremmt Lock-In database?** Editing `schema.sql` will not
> change an already-created database. Run the migrations in order in the SQL
> Editor:
>
> 1. [`supabase/migrations/0001_monthly_reward_allowance.sql`](./supabase/migrations/0001_monthly_reward_allowance.sql)
> 2. [`supabase/migrations/0002_trial_allowance.sql`](./supabase/migrations/0002_trial_allowance.sql)
> 3. [`supabase/migrations/0003_members_phone_lookup.sql`](./supabase/migrations/0003_members_phone_lookup.sql)
> 4. [`supabase/migrations/0004_cancellation_normalized_fields.sql`](./supabase/migrations/0004_cancellation_normalized_fields.sql)
> 5. [`supabase/migrations/0005_paid_allowance_three_and_trial_flag.sql`](./supabase/migrations/0005_paid_allowance_three_and_trial_flag.sql)
>
> These are non-destructive and idempotent — safe to re-run.

## 4. Add environment variables

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in every value (see the sections below for Stripe + admin values).
   Do **not** commit `.env.local`.

Required variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server only) |
| `STRIPE_SECRET_KEY` | Stripe secret key (server only) |
| `STRIPE_PRICE_ID` | The $10/month recurring price ID |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint |
| `NEXT_PUBLIC_SITE_URL` | Base URL, e.g. `http://localhost:3000` |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard |
| `NEXT_PUBLIC_DREMMT_PHONE` | Your 424 pilot number (shown in admin) |

Optional (needed for cancellation UX):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` | Stripe hosted customer portal link |

## 5. Create the Stripe $10/month product and price

1. In the Stripe Dashboard (Test mode), go to **Product catalog → Add product**.
2. Name it e.g. "Dremmt Membership".
3. Add a **recurring** price: **$10.00 / month**.
4. Save.

The 14-day free trial is applied in Checkout (`subscription_data.trial_period_days`),
not on the Price itself. Keep the Price at a plain $10/month recurring amount.

## 6. Copy the Stripe Price ID

1. Open the product, click the price.
2. Copy the **Price ID** (looks like `price_...`).
3. Put it in `STRIPE_PRICE_ID`.
4. Copy your **Secret key** from **Developers → API keys** into `STRIPE_SECRET_KEY`.

## 7. Run Stripe webhooks locally

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a webhook signing secret (`whsec_...`). Put it in
`STRIPE_WEBHOOK_SECRET`. Keep this process running while testing payments.

The webhook handles: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, and
`invoice.payment_failed`. It verifies the Stripe signature and is the
authoritative source of subscription state (including `trialing`, `active`,
`past_due`, `canceled`, and `cancel_at_period_end`).

## 8. Stripe free trial and cancellation setup

Checkout already starts a **14-day trial** and requires a card
(`payment_method_collection: "always"`) without charging today. You still need
to configure Stripe’s hosted customer portal so members can cancel without a
Dremmt account.

1. Open Stripe Dashboard → **Settings → Billing → Customer portal**.
2. Enable **subscription cancellation**.
3. Prefer cancellation **at the end of the current billing period** (members
   keep access until the period ends; the webhook flips status to `canceled`
   when Stripe sends `customer.subscription.deleted`).
4. Enable the **portal login link** (email + one-time code).
5. Enable **payment-method** and **invoice** management if appropriate.
6. Copy the **no-code portal URL** Stripe provides.
7. Add it to `.env.local` as:

```bash
NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL=
```

8. Restart the development server after changing environment variables.
9. Test the portal using the **same email** used during Stripe Checkout.

The in-app page is `/manage-membership`. Links appear in the footer, membership
section, checkout success page, and terms. If the portal URL is missing, the
site does not crash — development shows a setup message instead.

### How to test trial + cancellation

Use Stripe test mode and card `4242 4242 4242 4242`:

1. **Trial checkout** — complete `/create` → paywall → Checkout. You should
   not be charged today. After return, `members.subscription_status` should be
   `trialing`.
2. **One accepted plan during trial** — share the invite, accept it. That run’s
   `reward_status` should become `reserved`. `/create` should show
   “1 free plan available during your trial” only before that acceptance (or
   the used-trial message after).
3. **Second trial plan blocked** — create another invite while still
   `trialing` and accept it. The second acceptance should lock in **without**
   `reward_status = reserved`, and `/create` should show the used-trial
   message when trying to start another rewarded plan past the limit.
4. **Cancellation through the portal** — open `/manage-membership`, use the
   checkout email, cancel. Confirm Stripe marks the subscription to cancel at
   period end (or immediately, depending on portal settings).
5. **`cancel_at_period_end` webhook** — with the Stripe CLI listening, confirm
   `customer.subscription.updated` updates `members.cancel_at_period_end`.
6. **Trialing → active** — either wait for the trial to end in test clocks, or
   advance a Stripe test clock. Confirm `customer.subscription.updated` sets
   `subscription_status` to `active`.
7. **Three plans per calendar month after activation** — once `active`, accept
   three plans in the same calendar month (`reward_status = reserved`), then
   confirm a fourth acceptance does not reserve a reward. Trial rewards must
   not reduce the paid monthly count (`is_trial_reward`).

## 9. Start the local server

```bash
npm run dev
```

Open <http://localhost:3000>.

## 10. Test the full initiator and friend flow

1. Visit `/`, click **Make the plan**.
2. Complete the 5-step create flow (Step 3 uses the calendar → times → check
   subflow) → review the preview → **Try your first plan free**.
3. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.
4. You land back on the share page. Copy the invite link.
5. Open the invite link (ideally in a different browser / incognito), pick a
   time, click **I'm in**, add a phone number + consent, then **Lock it in**.
6. You should land on the locked page.
7. See [`TEST_FLOW.md`](./TEST_FLOW.md) for the complete checklist.

## 11. Open the admin dashboard

1. Go to `/admin`.
2. Enter `ADMIN_PASSWORD`.
3. You'll see summary counts, every run with full details, copy-able reminder
   texts, and status/reward actions.

## 12. Prepare for Vercel deployment

1. Push the repo to GitHub and import it into Vercel.
2. Add every variable from step 4 in **Vercel → Project → Settings → Environment
   Variables**. Set `NEXT_PUBLIC_SITE_URL` to your production URL. Add
   `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` from your live Customer Portal
   configuration.
3. In Stripe, create a **live** product/price and a **hosted webhook endpoint**
   pointing to `https://YOUR_DOMAIN/api/stripe/webhook`; copy its signing secret
   into `STRIPE_WEBHOOK_SECRET` (production).
4. Redeploy. Test one real (or test-mode) run end to end.

> Note: The success page verifies the Checkout Session to make local testing
> smooth, but the webhook remains the authoritative subscription updater. Both
> must be configured for production.
