import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "Alpha Schools <alpha_school@resend.dev>";

export interface EmailLocationInfo {
  name: string;
  address: string;
  city: string;
  state: string;
}

export interface EmailScoreInfo {
  overall: number | null;
  demographics: number | null;
  price: number | null;
  zoning: number | null;
  neighborhood: number | null;
  building: number | null;
}

function scoreBar(label: string, score: number | null): string {
  if (score === null) return "";
  const pct = label === "Overall" ? score : Math.round(score * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : pct >= 25 ? "#f59e0b" : "#ef4444";
  return `<tr><td style="padding:4px 8px;font-size:14px;">${label}</td><td style="padding:4px 8px;font-size:14px;font-weight:bold;color:${color};">${pct}</td></tr>`;
}

export function generateApprovalHtml(location: EmailLocationInfo, scores?: EmailScoreInfo): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreBar("Overall", scores.overall)}
        ${scoreBar("Demographics", scores.demographics)}
        ${scoreBar("Price", scores.price)}
        ${scoreBar("Zoning", scores.zoning)}
        ${scoreBar("Neighborhood", scores.neighborhood)}
        ${scoreBar("Building", scores.building)}
      </table>
    `;
  }

  return `
    <h2>Great news!</h2>
    <p>Your suggested location <strong>${location.name}</strong> at ${location.address}, ${location.city}, ${location.state} has been approved and is now live on the Parent Picker map.</p>
    ${scoreSection}
    <p>Share the link with other parents to rally votes for this location!</p>
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
  `;
}

export function generateRejectionHtml(location: EmailLocationInfo, scores?: EmailScoreInfo): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreBar("Overall", scores.overall)}
        ${scoreBar("Demographics", scores.demographics)}
        ${scoreBar("Price", scores.price)}
        ${scoreBar("Zoning", scores.zoning)}
        ${scoreBar("Neighborhood", scores.neighborhood)}
        ${scoreBar("Building", scores.building)}
      </table>
      <p style="font-size:13px;color:#666;">These scores help us evaluate whether a location meets the requirements for a micro school.</p>
    `;
  }

  return `
    <h2>Thank you for your suggestion</h2>
    <p>We reviewed <strong>${location.name}</strong> at ${location.address}, ${location.city}, ${location.state} but unfortunately it doesn't meet our current criteria for a micro school location.</p>
    ${scoreSection}
    <p>We appreciate your help in finding great locations! Feel free to suggest other spots you think would work well.</p>
    <p><a href="https://parentpicker.vercel.app">Suggest another location</a></p>
  `;
}

export function generateHelpGuideHtml(location?: { address: string; name?: string | null }): string {
  const heading = location
    ? `Here's how you can help with ${location.name || location.address}`
    : "Here's how you can help bring Alpha to your area";

  const locationLine = location
    ? `<p style="background:#f0f9ff;padding:12px;border-radius:8px;font-size:14px;">📍 <strong>${location.address}</strong></p>`
    : "";

  return `
    <h2>${heading}</h2>
    <p>Thank you for volunteering to help! Parents have 100x the local knowledge we do, and your involvement makes a real difference.</p>
    ${locationLine}
    <h3 style="margin-top:24px;">4 Ways You Can Help</h3>
    <table style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:12px;vertical-align:top;border-bottom:1px solid #eee;">
          <strong>🏢 Connect us with property owners</strong><br/>
          <span style="font-size:13px;color:#666;">Know the landlord or property manager? An intro goes a long way. Even just the name of the building owner helps us reach out.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;vertical-align:top;border-bottom:1px solid #eee;">
          <strong>📋 Help with zoning &amp; permitting</strong><br/>
          <span style="font-size:13px;color:#666;">Know someone at city hall? A local attorney who handles zoning? School use often needs special permits — local connections are invaluable.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;vertical-align:top;border-bottom:1px solid #eee;">
          <strong>👥 Rally other parents</strong><br/>
          <span style="font-size:13px;color:#666;">Share the Parent Picker link with parents in your area. More votes = stronger signal that this location has real demand.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;vertical-align:top;">
          <strong>🔑 Introduce us to government contacts</strong><br/>
          <span style="font-size:13px;color:#666;">Local school board members, city council reps, or planning commission contacts can help smooth the path for a new school.</span>
        </td>
      </tr>
    </table>
    <p style="margin-top:24px;"><a href="https://parentpicker.vercel.app">View locations on Parent Picker</a></p>
  `;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log("Resend not configured, skipping email to", to);
    return;
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, replyTo: "real_estate@alpha.school", to, subject, html });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
