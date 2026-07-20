"use client";

import { useState, useSyncExternalStore } from "react";
import { primaryButton, accentButton, secondaryButton } from "./ui";

const noop = () => () => {};

export function ShareActions({
  url,
  message,
}: {
  url: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Read Web Share support without setState-in-effect (false on the server).
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  const fullMessage = `${message}\n${url}`;
  const smsHref = `sms:?&body=${encodeURIComponent(fullMessage)}`;

  async function handleShare() {
    try {
      await navigator.share({ title: "Dremmt run", text: message, url });
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  async function handleCopy() {
    setCopyFailed(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canShare ? (
          <button type="button" onClick={handleShare} className={primaryButton}>
            Share invite
          </button>
        ) : null}
        <a href={smsHref} className={accentButton}>
          Text invite
        </a>
        <button type="button" onClick={handleCopy} className={secondaryButton}>
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      <label className="sr-only" htmlFor="invite-url">
        Invitation link
      </label>
      <input
        id="invite-url"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-md border border-border-strong bg-cream px-4 py-3 text-sm text-navy"
      />
      {copyFailed ? (
        <p className="text-sm text-orange-deep">
          Couldn&apos;t copy automatically — tap the link above to select it.
        </p>
      ) : null}
    </div>
  );
}
