import { ImageResponse } from "next/og";
import { getRunByToken } from "./data";
import { buildInvitePreview } from "./invite-preview";

/**
 * Shared renderer for the invitation social-preview image, used by both the
 * `opengraph-image` and `twitter-image` route conventions under
 * `src/app/invite/[token]/`.
 *
 * The card is intentionally warm and social — Dremmt blue, cream background,
 * elegant serif headline — and never mentions pricing, trials, or discounts.
 */

export const INVITE_OG_SIZE = { width: 1200, height: 630 } as const;
export const INVITE_OG_CONTENT_TYPE = "image/png";
export const INVITE_OG_ALT = "You're invited with Dremmt";

/** Brand palette mirrored from globals.css @theme tokens. */
const COLORS = {
  cream: "#faf7f0",
  surface: "#ffffff",
  navy: "#17263b",
  navySoft: "#2c3d55",
  sky: "#6e9fd6",
  skyDeep: "#4f7fb8",
  border: "#e7e0d2",
  borderStrong: "#d6cbb5",
  muted: "#6d6559",
} as const;

/**
 * Fetch a Google Font as a TTF ArrayBuffer, subset to the glyphs we render.
 * The css2 endpoint returns truetype URLs for non-browser user agents.
 * Returns null on any failure so the image still renders with a fallback font.
 */
async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const cssResponse = await fetch(url);
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();
    const match = css.match(
      /src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/,
    );
    if (!match?.[1]) return null;
    const fontResponse = await fetch(match[1]);
    if (!fontResponse.ok) return null;
    return await fontResponse.arrayBuffer();
  } catch {
    return null;
  }
}

// Baseline glyphs so any organizer/restaurant name still renders even when the
// subset is derived from short content strings.
const BASE_GLYPHS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?'’“”—–·:;&+/()@$#%→";

export async function renderInvitePreviewImage(
  token: string,
): Promise<ImageResponse> {
  const run = await getRunByToken(token);
  const preview = buildInvitePreview(run);

  const eyebrow = preview.eyebrow.toUpperCase();
  const wordmark = "Dremmt";
  const cityLabel = "CULVER CITY";
  const badge = "INVITATION";
  const ctaLabel = `${preview.cta}  →`;

  const allText =
    BASE_GLYPHS +
    [
      wordmark,
      cityLabel,
      badge,
      eyebrow,
      preview.organizerLine,
      preview.secondary,
      ctaLabel,
      preview.rewardNote,
      ...preview.chips,
    ].join(" ");

  const [eczar600, plex400, plex600] = await Promise.all([
    loadGoogleFont("Eczar", 600, allText),
    loadGoogleFont("IBM Plex Sans", 400, allText),
    loadGoogleFont("IBM Plex Sans", 600, allText),
  ]);

  const fonts = [
    eczar600 && { name: "Eczar", data: eczar600, weight: 600 as const, style: "normal" as const },
    plex400 && { name: "Plex", data: plex400, weight: 400 as const, style: "normal" as const },
    plex600 && { name: "Plex", data: plex600, weight: 600 as const, style: "normal" as const },
  ].filter(Boolean) as {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 600;
    style: "normal";
  }[];

  const serif = eczar600 ? "Eczar" : "serif";
  const sans = plex400 || plex600 ? "Plex" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 56,
          background: `linear-gradient(135deg, ${COLORS.cream} 0%, #eaf1fa 100%)`,
          fontFamily: sans,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 32,
            boxShadow: "0 24px 64px rgba(23,38,59,0.14)",
            padding: 64,
          }}
        >
          {/* Header: wordmark + invitation badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: serif,
                  fontWeight: 600,
                  fontSize: 46,
                  color: COLORS.skyDeep,
                  lineHeight: 1,
                }}
              >
                {wordmark}
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: 5,
                  color: COLORS.navy,
                  opacity: 0.65,
                  marginTop: 8,
                }}
              >
                {cityLabel}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(79,127,184,0.12)",
                color: COLORS.skyDeep,
                borderRadius: 999,
                padding: "12px 22px",
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 18,
                letterSpacing: 2,
              }}
            >
              {badge}
            </div>
          </div>

          {/* Main invitation copy */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: 4,
                color: COLORS.skyDeep,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                fontFamily: serif,
                fontWeight: 600,
                fontSize: 62,
                lineHeight: 1.06,
                color: COLORS.navy,
                marginTop: 18,
                maxWidth: 940,
              }}
            >
              {preview.organizerLine}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 400,
                fontSize: 30,
                color: COLORS.navySoft,
                marginTop: 20,
              }}
            >
              {preview.secondary}
            </div>
            {preview.chips.length > 0 ? (
              <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
                {preview.chips.map((chip) => (
                  <div
                    key={chip}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: `1px solid ${COLORS.borderStrong}`,
                      background: COLORS.cream,
                      borderRadius: 999,
                      padding: "12px 24px",
                      fontFamily: sans,
                      fontWeight: 600,
                      fontSize: 24,
                      color: COLORS.navy,
                    }}
                  >
                    {chip}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer: CTA + subtle reward note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: COLORS.skyDeep,
                color: "#ffffff",
                borderRadius: 999,
                padding: "18px 34px",
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 26,
              }}
            >
              {ctaLabel}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: sans,
                fontWeight: 400,
                fontSize: 20,
                color: COLORS.muted,
                maxWidth: 360,
                textAlign: "right",
                lineHeight: 1.35,
              }}
            >
              {preview.rewardNote}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...INVITE_OG_SIZE,
      ...(fonts.length > 0 ? { fonts } : {}),
    },
  );
}
