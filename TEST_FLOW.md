# Dremmt Lock-In — Manual Test Checklist

Run through this after setup (see `README_SETUP.md`). Use Stripe **test mode**
and the card `4242 4242 4242 4242`.

## Landing page
- [ ] `/` loads with the Dremmt wordmark (Culver City), "How it works" link,
      "Why $10?" link, and "Make the plan".
- [ ] Hero copy mentions “at least $6 toward the outing” and the 14-day trial.
- [ ] Membership line reads “First plan free for 14 days · then $10/month · …”
- [ ] Example invitation shows two time chips and “I’m in”.
- [ ] Membership section says “Try your first plan free for 14 days,” card
      required note, and “Manage or cancel membership”.

## Mobile responsiveness
- [ ] At 320px, 375px, and 430px there is no horizontal scrolling on any page.
- [ ] Create-flow calendar cells remain tappable; time rows span full width.
- [ ] Bottom actions do not cover content.

## Desktop responsiveness
- [ ] On wide screens the landing uses a two-column hero (copy + sample invite).
- [ ] Create Step 3 keeps a controlled reading width (not edge-to-edge).
- [ ] Flow and hierarchy match the mobile version.

## Create Step 3 — scheduling subflow
- [ ] Tab 1 shows an inline month calendar (not a native date input).
- [ ] Past dates are disabled; up to two days can be selected; re-tap deselects.
- [ ] “Choose times” stays disabled until at least one day is selected.
- [ ] Tab 2 shows large pill time rows (12–2, 2–5, 5–7, 7–9) with descriptors.
- [ ] Maximum of two date+time combinations total; limit message appears.
- [ ] Tab 3 previews polished chips; Back preserves selections; Continue works.
- [ ] Final selections serialize into `time_option_one` / `time_option_two`.

## Required validation
- [ ] Step 1 requires both names.
- [ ] Step 2 requires a restaurant name; link/location are optional.
- [ ] Step 3 requires at least one date+time combination.
- [ ] Step 5 requires a valid phone, a valid email, and the consent checkbox.
- [ ] Invalid values show inline error messages (not silent failures).

## Preview
- [ ] The preview matches what the friend will receive (title, restaurant,
      location, both windows, message).
- [ ] "Edit plan" returns to the steps; "Continue" proceeds.

## Stripe trial checkout
- [ ] Non-member paywall says “Try your first plan free for 14 days.”
- [ ] Checkout opens in subscription mode; card is required; no charge today.
- [ ] A `runs` row is created with status `awaiting_payment` **before** redirect.
- [ ] After checkout, you're redirected back and the run becomes `ready`.
- [ ] `members.subscription_status` is `trialing`.
- [ ] The Stripe CLI shows `checkout.session.completed` handled by the webhook.
- [ ] Canceling checkout returns to `/create?canceled=1` with a notice.

## Share link
- [ ] Share page shows "Your Dremmt run is ready." with the full plan.
- [ ] Suggested message is present.
- [ ] "Copy link" works; "Text invite" opens an SMS draft; Web Share appears on
      supported devices; copy-link fallback always present.
- [ ] “Manage or cancel membership” link is present.

## Friend accepts
- [ ] Opening `/invite/[token]` shows the full outing immediately.
- [ ] Time options match the calendar selections from create.
- [ ] "I'm in" → phone + consent → "Lock it in" redirects to `/locked/[token]`.
- [ ] Locked page shows names, restaurant, location, selected time, reward
      section, and the "no reservation held" note.

## Friend says neither time works
- [ ] "Neither time works" sets the run to `time_conflict`.
- [ ] Friend sees the "No worries" message.
- [ ] No allowance is consumed (check `runs.reward_status` stays `none`).

## Trial allowance (1 completed plan during trial)
> Requires `supabase/migrations/0002_trial_allowance.sql` to have been run.
- [ ] While `trialing`, `/create` shows “1 free plan available during your trial”
      before the first rewarded acceptance.
- [ ] First acceptance sets `reward_status = reserved`.
- [ ] A second acceptance during the trial does **not** reserve a reward.
- [ ] `/create` shows the used-trial message after the trial plan is used.

## Monthly reward allowance (3 completed plans / calendar month)
> Requires migrations through `0005` (or fresh `schema.sql`). Active members only.
- [ ] After activation (`subscription_status = active`), first acceptance this
      month reserves a reward; status shows “2 of 3 plans left this month”.
- [ ] After a second acceptance, status shows “1 of 3 plans left this month”.
- [ ] After a third acceptance, status shows “0 of 3 plans left this month”
      and blocks further rewarded plans with a message naming the next reset
      date (first of next month).
- [ ] A fourth plan accepted the same month does **not** get
      `reward_status = reserved`.
- [ ] A prior trial plan (`is_trial_reward`) does **not** reduce the paid 3.
- [ ] In a new calendar month, the allowance is available again.

## Returning member
- [ ] Landing “Already a member? Make another plan” opens `/returning-member`.
- [ ] Known trialing/active phone reaches the status screen (no new member row).
- [ ] Unknown phone shows “We couldn’t find a membership with that number.”
- [ ] Inactive phone shows restart + manage actions (no silent access).
- [ ] Cookies alone cannot grant access without a matching phone lookup.

## Duplicate acceptance is prevented
- [ ] Reopening an accepted invite link shows the locked plan (cannot re-accept).
- [ ] A member's allowance is never exceeded even if two invitations are
      accepted at nearly the same time (enforced by the `reserve_reward`
      Postgres function, not just application code).

## Manage membership / cancellation
- [ ] `/manage-membership` loads without crashing when the portal URL is missing
      (dev shows a setup message).
- [ ] With `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` set, the button opens Stripe’s
      portal.
- [ ] Portal login works with the checkout email (one-time code).
- [ ] Canceling schedules end-of-period cancellation when portal is configured
      that way; webhook updates `cancel_at_period_end`.
- [ ] Footer, membership section, success page, and terms all link here.

## Admin dashboard
- [ ] `/admin` requires the password; wrong password is rejected.
- [ ] Runs show initiator/friend contact details, windows, reward status.
- [ ] “Release this reward” frees that run’s slot for the month/trial.
- [ ] Mark sent / completed / cancelled actions update the run.

## Terms
- [ ] Terms state 14-day trial, card required, $10/month after trial, one trial
      plan, three plans/month when active, ≥$6, 24-hour pilot delivery, and
      cancellation via Stripe customer portal.
