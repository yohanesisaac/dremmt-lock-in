import { surfaceCard, eyebrowClass } from "./ui";
import { formatTimeWindowShort } from "@/lib/time-windows";
import type { TimeWindow, WindowPreset } from "@/lib/types";

const PRESET_TITLE: Record<WindowPreset, string> = {
  lunch: "Lunch",
  afternoon: "Afternoon",
  evening: "Evening",
  custom: "A plan",
};

export function planTitle(friendName: string, primary: TimeWindow): string {
  return `${PRESET_TITLE[primary.preset]} with ${friendName}`;
}

interface PlanCardProps {
  friendName: string;
  restaurantName: string;
  location?: string | null;
  restaurantLink?: string | null;
  windows: TimeWindow[];
  selectedWindow?: TimeWindow | null;
  personalMessage?: string | null;
  footer?: React.ReactNode;
}

export function PlanCard({
  friendName,
  restaurantName,
  location,
  restaurantLink,
  windows,
  selectedWindow,
  personalMessage,
  footer,
}: PlanCardProps) {
  const primary = selectedWindow ?? windows[0];
  const shownWindows = selectedWindow ? [selectedWindow] : windows;

  return (
    <article className={`${surfaceCard} overflow-hidden`}>
      <div className="border-b border-border bg-cream/60 px-6 py-5">
        <p className={eyebrowClass}>Dremmt run</p>
        <h2 className="mt-1 text-3xl text-navy">
          {planTitle(friendName, primary)}
        </h2>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div>
          <p className="text-lg font-semibold text-navy">{restaurantName}</p>
          {location ? <p className="text-muted">{location}</p> : null}
          {restaurantLink ? (
            <a
              href={restaurantLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-orange-deep underline underline-offset-4"
            >
              View restaurant link
            </a>
          ) : null}
        </div>

        <div>
          <p className={eyebrowClass}>
            {selectedWindow ? "Locked window" : "Proposed windows"}
          </p>
          <ul className="mt-2 space-y-2">
            {shownWindows.map((window, index) => (
              <li key={`${window.date}-${window.start}-${index}`}>
                <div className="flex items-baseline gap-2">
                  {!selectedWindow && index > 0 ? (
                    <span className="text-sm text-muted">or</span>
                  ) : null}
                  <span className="text-lg font-medium text-navy">
                    {formatTimeWindowShort(window)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {personalMessage ? (
          <blockquote className="rounded-md border-l-2 border-orange bg-cream/70 px-4 py-3 text-navy">
            “{personalMessage}”
          </blockquote>
        ) : null}

        {footer ? <div className="pt-1">{footer}</div> : null}
      </div>
    </article>
  );
}
