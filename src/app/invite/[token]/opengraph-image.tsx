import {
  INVITE_OG_ALT,
  INVITE_OG_CONTENT_TYPE,
  INVITE_OG_SIZE,
  renderInvitePreviewImage,
} from "@/lib/invite-og";

export const alt = INVITE_OG_ALT;
export const size = INVITE_OG_SIZE;
export const contentType = INVITE_OG_CONTENT_TYPE;

export default async function InviteOpengraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return renderInvitePreviewImage(token);
}
