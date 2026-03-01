import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "Alpha Schools <info@real-estate.alpha.school>";

export interface EmailLocationInfo {
  name: string;
  address: string;
  city: string;
  state: string;
}

export interface ScoredEmailParams {
  location: EmailLocationInfo;
  locationId: string;
  detailsUrl?: string | null;
}

export function generateScoredNotificationHtml({ location, locationId, detailsUrl }: ScoredEmailParams): string {
  const mapUrl = `https://parentpicker.vercel.app/?location=${locationId}`;

  const detailsLink = detailsUrl
    ? `&nbsp;&nbsp;<a href="${detailsUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Full Score Details</a>`
    : "";

  return `
    <h2>Your suggested location has been evaluated!</h2>
    <p><strong>${location.address}</strong>, ${location.city}, ${location.state} has been scored by our site selection system.</p>
    <div style="margin-top:24px;">
      <a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
      ${detailsLink}
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">Our team is reviewing this location. We'll let you know when it goes live so you can rally other parents to vote for it!</p>
  `;
}

export function generateLocationHelpHtml(
  address: string,
  city: string,
  state: string,
  locationId: string,
  detailsUrl?: string | null
): string {
  const mapUrl = `https://parentpicker.vercel.app/?location=${locationId}`;
  const helpUrl = detailsUrl
    ? `${detailsUrl}${detailsUrl.includes("?") ? "&" : "?"}tab=help`
    : null;
  const helpLink = helpUrl
    ? `<a href="${helpUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See How You Can Help</a>&nbsp;&nbsp;`
    : "";

  return `
    <h2>We need your help with a location you care about</h2>
    <p><strong>${address}</strong>, ${city}, ${state} needs your local knowledge. Parents have 100x the local knowledge we do, and your involvement makes a real difference.</p>
    <div style="margin-top:24px;">
      ${helpLink}<a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">Know the landlord? Have a zoning contact? Even small connections help us move faster. Click above to see specific ways you can help.</p>
  `;
}

export function generateGenericHelpHtml(): string {
  return `
    <h2>Thank you for volunteering!</h2>
    <p>We've noted your willingness to help — parents like you make all the difference. You have 100x the local knowledge we do.</p>
    <p>Browse locations near you and pick one you'd like to help with. Once you do, we'll send you specific details on how you can make a difference for that location.</p>
    <div style="margin-top:24px;">
      <a href="https://parentpicker.vercel.app" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Browse Locations</a>
    </div>
  `;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!resend) {
    console.log("Resend not configured, skipping email to", to);
    return { success: false, error: "Resend not configured" };
  }

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, replyTo: "real-estate@alpha.school", to, subject, html });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send email:", error);
    return { success: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateInviteHtml(inviterName: string): string {
  const safe = escapeHtml(inviterName);
  return `
    <h2>${safe} invited you to help choose a school location</h2>
    <p>Alpha School is opening new micro schools, and families are choosing where. ${safe} thinks you'd want to be part of it.</p>
    <p><strong>What Alpha Feels Like:</strong> Two hours of focused academics. Then the rest of the day building real things — businesses, robots, films, friendships.</p>
    <div style="margin-top:24px;">
      <a href="https://parentpicker.vercel.app" style="display:inline-block;padding:14px 28px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See Locations Near You</a>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#666;">Say "I'm in" on locations you like. Enough families, and it happens.</p>
  `;
}
