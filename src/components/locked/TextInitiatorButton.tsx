import { accentButton } from "@/components/ui";

export function TextInitiatorButton({
  initiatorName,
  smsHref,
}: {
  initiatorName: string;
  smsHref: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-navy">
        {`Text ${initiatorName} so they know you're in`}
      </p>
      <a href={smsHref} className={accentButton}>
        Text {initiatorName}
      </a>
    </div>
  );
}
