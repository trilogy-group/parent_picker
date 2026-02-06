import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "Alpha Schools <onboarding@resend.dev>";

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

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log("Resend not configured, skipping email to", to);
    return;
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
