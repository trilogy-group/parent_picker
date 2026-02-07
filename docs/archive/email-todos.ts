import { LocationTodo } from "@/types";

interface TodoEmailLocation {
  name: string;
  address: string;
  city: string;
  state: string;
}

interface TodoEmailScores {
  overall: number | null;
  demographics: number | null;
  price: number | null;
  zoning: number | null;
  neighborhood: number | null;
  building: number | null;
}

function scoreRow(label: string, score: number | null, isOverall = false): string {
  if (score === null) return "";
  const pct = isOverall ? score : Math.round(score * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : pct >= 25 ? "#f59e0b" : "#ef4444";
  return `<tr><td style="padding:4px 8px;font-size:14px;">${label}</td><td style="padding:4px 8px;font-size:14px;font-weight:bold;color:${color};">${pct}</td></tr>`;
}

const TODO_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  zoning: { bg: "#fef2f2", border: "#fca5a5", header: "#dc2626" },
  demographics: { bg: "#fefce8", border: "#fde047", header: "#ca8a04" },
  pricing: { bg: "#fff7ed", border: "#fdba74", header: "#ea580c" },
};

function todoSection(todo: LocationTodo): string {
  const colors = TODO_COLORS[todo.type] || TODO_COLORS.zoning;

  let dataTableHtml = "";
  if (todo.dataTable && todo.dataTable.length > 0) {
    const hasGapColumn = todo.dataTable.some((row) => row.gap !== undefined);

    const rows = todo.dataTable
      .map(
        (row) =>
          `<tr>
            <td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;">${row.label}</td>
            <td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${row.current}</td>
            <td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">${row.needed}</td>
            ${hasGapColumn ? `<td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${row.gap || ""}</td>` : ""}
          </tr>`
      )
      .join("");

    dataTableHtml = `
      <table style="border-collapse:collapse;width:100%;margin-top:10px;background:#fff;border-radius:4px;">
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Metric</th>
          <th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Current</th>
          <th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">What We Need</th>
          ${hasGapColumn ? `<th style="padding:6px 10px;font-size:12px;text-align:left;font-weight:600;">Gap</th>` : ""}
        </tr>
        ${rows}
      </table>
    `;
  }

  return `
    <div style="margin-top:16px;border:1px solid ${colors.border};border-radius:8px;overflow:hidden;">
      <div style="background:${colors.bg};padding:10px 14px;border-bottom:1px solid ${colors.border};">
        <h3 style="margin:0;font-size:15px;color:${colors.header};">${todo.title}</h3>
      </div>
      <div style="padding:12px 14px;">
        <p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:#374151;">${todo.message}</p>
        ${dataTableHtml}
      </div>
    </div>
  `;
}

export function generateLikerEmailHtml(
  location: TodoEmailLocation,
  scores: TodoEmailScores | undefined,
  todos: LocationTodo[]
): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreRow("Overall", scores.overall, true)}
        ${scoreRow("Demographics", scores.demographics)}
        ${scoreRow("Price", scores.price)}
        ${scoreRow("Zoning", scores.zoning)}
        ${scoreRow("Neighborhood", scores.neighborhood)}
        ${scoreRow("Building", scores.building)}
      </table>
    `;
  }

  const todoSections = todos.map(todoSection).join("");

  const todoIntro =
    todos.length > 0
      ? `<p style="margin-top:16px;font-size:14px;color:#374151;">
          There are a few things that need your help to make this location work.
          See the action items below:
        </p>`
      : "";

  const cta =
    todos.length > 0
      ? `<p style="margin-top:16px;">Share the link with other parents to rally support and help with these action items!</p>`
      : `<p>Share the link with other parents to rally votes for this location!</p>`;

  return `
    <h2>Location Update</h2>
    <p>The location you liked at <strong>${location.address}</strong>, ${location.city}, ${location.state} has been scored. Here&rsquo;s what we found:</p>
    ${scoreSection}
    ${todoIntro}
    ${todoSections}
    ${cta}
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
  `;
}

export function generateTodoApprovalHtml(
  location: TodoEmailLocation,
  scores: TodoEmailScores | undefined,
  todos: LocationTodo[]
): string {
  let scoreSection = "";
  if (scores?.overall != null) {
    scoreSection = `
      <h3 style="margin-top:20px;">Location Scores</h3>
      <table style="border-collapse:collapse;">
        ${scoreRow("Overall", scores.overall, true)}
        ${scoreRow("Demographics", scores.demographics)}
        ${scoreRow("Price", scores.price)}
        ${scoreRow("Zoning", scores.zoning)}
        ${scoreRow("Neighborhood", scores.neighborhood)}
        ${scoreRow("Building", scores.building)}
      </table>
    `;
  }

  const todoSections = todos.map(todoSection).join("");

  const todoIntro =
    todos.length > 0
      ? `<p style="margin-top:16px;font-size:14px;color:#374151;">
          There are a few things that need your help to make this location work.
          See the action items below:
        </p>`
      : "";

  const cta =
    todos.length > 0
      ? `<p style="margin-top:16px;">Share the link with other parents to rally support and help with these action items!</p>`
      : `<p>Share the link with other parents to rally votes for this location!</p>`;

  return `
    <h2>Great news!</h2>
    <p>Your suggested location <strong>${location.name}</strong> at ${location.address}, ${location.city}, ${location.state} has been approved and is now live on the Parent Picker map.</p>
    ${scoreSection}
    ${todoIntro}
    ${todoSections}
    ${cta}
    <p><a href="https://parentpicker.vercel.app">View on Parent Picker</a></p>
  `;
}
