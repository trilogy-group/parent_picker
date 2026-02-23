import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Alpha Schools <alpha_school@resend.dev>";
const TO = "andy.price@trilogy.com";

// Fake data for test emails
const fakeLocation = {
  address: "401 Congress Ave",
  city: "Austin",
  state: "TX",
  id: "test-location-123",
};
const fakeDetailsUrl = "https://parentpicker.vercel.app/details/test-location-123";
const mapUrl = `https://parentpicker.vercel.app/?location=${fakeLocation.id}`;

// Template 1: Scored Notification (auto — when REBL scores a parent suggestion)
const scoredHtml = `
  <h2>Your suggested location has been evaluated!</h2>
  <p><strong>${fakeLocation.address}</strong>, ${fakeLocation.city}, ${fakeLocation.state} has been scored by our site selection system.</p>
  <div style="margin-top:24px;">
    <a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
    &nbsp;&nbsp;<a href="${fakeDetailsUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Full Score Details</a>
  </div>
  <p style="margin-top:20px;font-size:13px;color:#666;">Our team is reviewing this location. We'll let you know when it goes live so you can rally other parents to vote for it!</p>
`;

// Template 2: Approval (manual — admin approves suggestion)
const approvalHtml = `
  <h2>Great news — your location is live!</h2>
  <p><strong>${fakeLocation.address}</strong>, ${fakeLocation.city}, ${fakeLocation.state} is now published on the Parent Picker map and visible to all parents.</p>
  <div style="margin-top:24px;">
    <a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
    &nbsp;&nbsp;<a href="${fakeDetailsUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Full Score Details</a>
  </div>
  <p style="margin-top:20px;">Share this link with other parents to rally votes for this location!</p>
`;

// Template 3: Rejection (manual — admin rejects suggestion)
const rejectionHtml = `
  <h2>Thank you for your suggestion</h2>
  <p>We reviewed <strong>${fakeLocation.address}</strong>, ${fakeLocation.city}, ${fakeLocation.state} but unfortunately it doesn't meet our current criteria for a micro school location.</p>
  <p>We appreciate your help in finding great locations! Feel free to suggest other spots you think would work well.</p>
  <p style="margin-top:24px;"><a href="https://parentpicker.vercel.app/suggest" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Suggest Another Location</a></p>
`;

// Template 4: Voter Help Request (manual — admin asks voters for help)
const helpUrl = `${fakeDetailsUrl}?tab=help`;
const voterHelpHtml = `
  <h2>We need your help with a location you care about</h2>
  <p>You voted for <strong>${fakeLocation.address}</strong>, ${fakeLocation.city}, ${fakeLocation.state} — and we're making progress! Parents have 100x the local knowledge we do, and your involvement makes a real difference.</p>
  <div style="margin-top:24px;">
    <a href="${helpUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See How You Can Help</a>&nbsp;&nbsp;<a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
  </div>
  <p style="margin-top:20px;font-size:13px;color:#666;">Know the landlord? Have a zoning contact? Even small connections help us move faster. Click above to see specific ways you can help.</p>
`;

// Template 5: Location-specific Help (immediate — parent clicks "I can help" on a card)
const locationHelpHtml = `
  <h2>We need your help with a location you care about</h2>
  <p><strong>${fakeLocation.address}</strong>, ${fakeLocation.city}, ${fakeLocation.state} needs your local knowledge. Parents have 100x the local knowledge we do, and your involvement makes a real difference.</p>
  <div style="margin-top:24px;">
    <a href="${helpUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">See How You Can Help</a>&nbsp;&nbsp;<a href="${mapUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View on Map</a>
  </div>
  <p style="margin-top:20px;font-size:13px;color:#666;">Know the landlord? Have a zoning contact? Even small connections help us move faster. Click above to see specific ways you can help.</p>
`;

// Template 6: Generic Help (immediate — parent clicks "I want to help" from panel, no location)
const genericHelpHtml = `
  <h2>Thank you for volunteering!</h2>
  <p>We've noted your willingness to help — parents like you make all the difference. You have 100x the local knowledge we do.</p>
  <p>Browse locations near you and pick one you'd like to help with. Once you do, we'll send you specific details on how you can make a difference for that location.</p>
  <div style="margin-top:24px;">
    <a href="https://parentpicker.vercel.app" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Browse Locations</a>
  </div>
`;

const emails = [
  { subject: "[TEST 1/6] Scored Notification (auto — REBL scores suggestion)", html: scoredHtml },
  { subject: "[TEST 2/6] Approval (manual — admin approves)", html: approvalHtml },
  { subject: "[TEST 3/6] Rejection (manual — admin rejects)", html: rejectionHtml },
  { subject: "[TEST 4/6] Voter Help Request (manual — admin asks voters)", html: voterHelpHtml },
  { subject: "[TEST 5/6] Location Help (immediate — parent 'I can help' on card)", html: locationHelpHtml },
  { subject: "[TEST 6/6] Generic Help (immediate — parent 'I want to help' no location)", html: genericHelpHtml },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let i = 0; i < emails.length; i++) {
    const { subject, html } = emails[i];
    if (i > 0) await sleep(1500); // respect 2/sec rate limit
    try {
      const result = await resend.emails.send({
        from: FROM,
        replyTo: "real_estate@alpha.school",
        to: TO,
        subject,
        html,
      });
      console.log(`Sent: ${subject} → id=${result.data?.id || "error"}`);
    } catch (err) {
      console.error(`Failed: ${subject}`, err);
    }
  }
  console.log("\nAll 6 test emails sent to", TO);
}

main();
