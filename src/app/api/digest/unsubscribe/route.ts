import { verifyUnsubscribe } from "@/lib/digest";
import { setEmailDigest } from "@/lib/profiles";

// RFC 8058 one-click unsubscribe target for the weekly digest (issue #38).
// Mail providers POST here from their own "Unsubscribe" button. Browsers
// get the confirmation page at /digest/unsubscribe instead, so link
// scanners that GET every URL can't unsubscribe anyone.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("u") ?? "";
  const token = searchParams.get("t") ?? "";
  if (!userId || !verifyUnsubscribe(userId, token)) {
    return new Response("Invalid unsubscribe link", { status: 400 });
  }
  await setEmailDigest(userId, false);
  return new Response("Unsubscribed", { status: 200 });
}
