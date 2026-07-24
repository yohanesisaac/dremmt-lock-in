"use client";

import { useId, useState } from "react";

const DETAILS = [
  {
    question: "When does a plan count?",
    answer:
      "A plan counts when your friend picks a time and taps “I’m in.” That locks the restaurant, time window, and reward.",
  },
  {
    question: "What if they decline?",
    answer:
      "Declined invitations and “Neither time works” do not use one of your plans.",
  },
  {
    question: "When do we get the reward?",
    answer:
      "Go together during the agreed window. A Dremmt number starting with 424 will text you that day. Reply with one food, table, or restaurant photo.",
  },
  {
    question: "What happens if we miss the time?",
    answer:
      "The reward is only available during the window you both agreed to. Miss it and the reward disappears—so don't flake.",
  },
  {
    // Subscription/allowance language — hidden in behavior-test mode.
    question: "When is the plan deducted from my allowance?",
    answer:
      "It is reserved when your friend taps “I’m in,” not when Dremmt later sends the reward.",
    subscriptionRelated: true,
  },
  {
    // Trial + paid monthly pricing — hidden in behavior-test mode.
    question: "How many plans do I get?",
    answer:
      "Your 14-day trial includes 1 rewarded plan. Paid membership includes 3 rewarded plans each calendar month.",
    subscriptionRelated: true,
  },
  {
    // Paid monthly reset — hidden in behavior-test mode.
    question: "Do unused plans roll over?",
    answer: "No. Paid plans reset each calendar month.",
    subscriptionRelated: true,
  },
] as const;

export function MoreDetails({
  behaviorTest = false,
}: {
  behaviorTest?: boolean;
}) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // In behavior-test mode there is no subscription, so drop any pricing /
  // trial / monthly-allowance FAQ items entirely.
  const details = behaviorTest
    ? DETAILS.filter((item) => !("subscriptionRelated" in item && item.subscriptionRelated))
    : DETAILS;

  return (
    <section className="border-b border-border bg-cream">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <h2 className="text-2xl text-navy sm:text-3xl">More details</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {details.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `${baseId}-panel-${index}`;
            const buttonId = `${baseId}-button-${index}`;

            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium text-navy transition-colors hover:text-navy-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span
                      aria-hidden
                      className="shrink-0 text-lg leading-none text-muted"
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-4"
                >
                  <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
