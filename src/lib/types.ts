export type RunStatus =
  | "awaiting_payment"
  | "ready"
  | "pending_friend"
  | "accepted"
  | "time_conflict"
  | "completed"
  | "cancelled";

export type RewardStatus = "none" | "reserved" | "sent" | "released";

export type SubscriptionStatus =
  | "incomplete"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "inactive";

export type WindowPreset = "lunch" | "afternoon" | "evening" | "custom";

export interface TimeWindow {
  /** ISO date, YYYY-MM-DD */
  date: string;
  preset: WindowPreset;
  /** 24h HH:MM */
  start: string;
  /** 24h HH:MM */
  end: string;
}

export interface MemberRow {
  id: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  sms_consent: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  /** Raw Stripe cancel_at_period_end boolean. */
  cancel_at_period_end: boolean;
  /** Stripe canceled_at — when cancellation was requested. */
  cancellation_requested_at: string | null;
  /** Stripe cancel_at — when access is scheduled to end. */
  access_ends_at: string | null;
  member_access_token: string;
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: string;
  invite_token: string;
  member_id: string | null;
  initiator_name: string;
  initiator_phone: string;
  initiator_email: string;
  initiator_sms_consent: boolean;
  friend_name: string;
  restaurant_name: string;
  restaurant_link: string | null;
  location: string | null;
  time_option_one: TimeWindow;
  time_option_two: TimeWindow | null;
  personal_message: string | null;
  selected_time: TimeWindow | null;
  friend_phone: string | null;
  friend_sms_consent: boolean;
  status: RunStatus;
  reward_status: RewardStatus;
  /** True when reserved during a Stripe trial; excluded from paid monthly counts. */
  is_trial_reward: boolean;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  reward_sent_at: string | null;
}
