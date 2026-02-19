import type { Activity, YearStats, Totals, TypeStats } from "./types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_ABBREV = ["S", "M", "T", "W", "T", "F", "S"];

const ACTIVITY_ICONS: Record<string, string> = {
  Run: "footprints",
  Ride: "bike",
  WeightTraining: "dumbbell",
  Swim: "waves",
  Yoga: "flower-2",
  Hike: "mountain",
  Walk: "footprints",
  Workout: "heart-pulse",
  Squash: "circle-dot",
  VirtualRide: "bike",
  VirtualRun: "footprints",
};
const DEFAULT_ICON = "activity";

const DISTANCE_TYPES = ["Run", "Ride"];
const DURATION_TYPES = ["WeightTraining"];

type DayActivities = Record<number, Activity[]>;
type MonthActivities = Record<number, DayActivities>;
type YearActivities = Record<number, MonthActivities>;

// Main entry point: render all year pages for a user, returns { year: html }
export function renderUserPages(
  activities: Activity[],
  firstname: string
): Record<number, string> {
  const byYear = groupActivities(activities);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Ensure current year exists
  if (!byYear[currentYear]) byYear[currentYear] = {};

  const allYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  const yearStats = calculateYearStats(activities);
  const totals = calculateTotals(activities);
  const generatedAt = new Date().toISOString();

  const pages: Record<number, string> = {};

  for (const year of allYears) {
    const isCurrentYear = year === currentYear;
    pages[year] = renderPage({
      year,
      months: byYear[year],
      totals,
      yearStats: yearStats[year] || emptyStats(),
      allYears,
      currentYear,
      currentMonth,
      isCurrentYear,
      generatedAt,
      firstname,
    });
  }

  return pages;
}

function groupActivities(activities: Activity[]): YearActivities {
  const byYear: YearActivities = {};

  for (const activity of activities) {
    const [y, m, d] = activity.date.split("-").map(Number);
    if (!byYear[y]) byYear[y] = {};
    if (!byYear[y][m]) byYear[y][m] = {};
    if (!byYear[y][m][d]) byYear[y][m][d] = [];
    byYear[y][m][d].push(activity);
  }

  return byYear;
}

function calculateYearStats(activities: Activity[]): Record<number, YearStats> {
  const stats: Record<number, YearStats> = {};

  for (const a of activities) {
    const year = parseInt(a.date.slice(0, 4));
    if (!stats[year]) stats[year] = emptyStats();

    stats[year].count++;
    stats[year].moving_time_hours += a.moving_time_minutes / 60;

    if (!stats[year].by_type[a.type]) {
      stats[year].by_type[a.type] = { count: 0, distance_km: 0, moving_time_hours: 0, elevation_gain_meters: 0 };
    }
    const t = stats[year].by_type[a.type];
    t.count++;
    t.distance_km += a.distance_km;
    t.moving_time_hours += a.moving_time_minutes / 60;
    t.elevation_gain_meters += a.elevation_gain_meters;
  }

  // Round
  for (const s of Object.values(stats)) {
    s.moving_time_hours = round(s.moving_time_hours, 2);
    for (const t of Object.values(s.by_type)) {
      t.distance_km = round(t.distance_km, 1);
      t.moving_time_hours = round(t.moving_time_hours, 1);
    }
  }

  return stats;
}

function calculateTotals(activities: Activity[]): Totals {
  const totals: Totals = {
    count: 0,
    distance_km: 0,
    moving_time_hours: 0,
    elevation_gain_meters: 0,
    by_type: {},
  };

  for (const a of activities) {
    totals.count++;
    totals.distance_km += a.distance_km;
    totals.moving_time_hours += a.moving_time_minutes / 60;
    totals.elevation_gain_meters += a.elevation_gain_meters;

    if (!totals.by_type[a.type]) {
      totals.by_type[a.type] = { count: 0, distance_km: 0, moving_time_hours: 0, elevation_gain_meters: 0 };
    }
    const t = totals.by_type[a.type];
    t.count++;
    t.distance_km += a.distance_km;
    t.moving_time_hours += a.moving_time_minutes / 60;
    t.elevation_gain_meters += a.elevation_gain_meters;
  }

  totals.distance_km = round(totals.distance_km, 1);
  totals.moving_time_hours = round(totals.moving_time_hours, 2);
  for (const t of Object.values(totals.by_type)) {
    t.distance_km = round(t.distance_km, 1);
    t.moving_time_hours = round(t.moving_time_hours, 2);
  }

  // Sort by count descending
  totals.by_type = Object.fromEntries(
    Object.entries(totals.by_type).sort(([, a], [, b]) => b.count - a.count)
  );

  return totals;
}

function emptyStats(): YearStats {
  return { count: 0, moving_time_hours: 0, by_type: {} };
}

interface PageOptions {
  year: number;
  months: MonthActivities;
  totals: Totals;
  yearStats: YearStats;
  allYears: number[];
  currentYear: number;
  currentMonth: number;
  isCurrentYear: boolean;
  generatedAt: string;
  firstname: string;
}

function renderPage(opts: PageOptions): string {
  const monthsToShow = opts.isCurrentYear
    ? range(1, opts.currentMonth)
    : range(1, 12);

  const monthsHtml = monthsToShow
    .map((m) => renderMonth(opts.year, m, opts.months[m] || {}))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.year} - ${opts.firstname}'s Strava Stats</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>${opts.year}</h1>
  <p class="updated">Updated ${formatDate(opts.generatedAt)}</p>

  ${renderYearLinks(opts.allYears, opts.currentYear, opts.year)}

  ${renderYearStatsHtml(opts.yearStats, opts.isCurrentYear)}

  <div class="months-grid">
    ${monthsHtml}
  </div>

  ${renderFooter(opts.totals)}

  <p class="attribution">
    <img src="https://developers.strava.com/images/api_logo_pwrdBy_strava_horiz_light.svg" alt="Powered by Strava" width="140">
  </p>

  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script>lucide.createIcons();</script>
</body>
</html>`;
}

function renderYearLinks(allYears: number[], currentYear: number, pageYear: number): string {
  const links = allYears
    .map((y) => {
      const href = `/u/USER_ID?year=${y}`;
      const cls = y === pageYear ? ' class="current"' : "";
      return `<a href="${href}"${cls}>${y}</a>`;
    })
    .join("\n        ");

  return `<div class="year-links">
    <div class="year-links-label">Years</div>
    ${links}
  </div>`;
}

function renderYearStatsHtml(yearStats: YearStats, isCurrentYear: boolean): string {
  const label = isCurrentYear ? "Year to Date" : "Total";
  const typeStats = renderTypeStats(yearStats.by_type);

  return `<div class="year-stats">
    <div class="stat-block">
      <span class="stat-block-label">${label}</span>
      <span class="stat-block-values"><span class="stat-value">${yearStats.count}</span><span class="stat-label">activities</span> <span class="stat-value">${formatHours(yearStats.moving_time_hours)}</span><span class="stat-label">hours</span></span>
    </div>
    ${typeStats}
  </div>`;
}

function renderTypeStats(byType: Record<string, TypeStats>): string {
  if (!byType || Object.keys(byType).length === 0) return "";

  const parts: string[] = [];
  const orderedTypes = [...DURATION_TYPES, ...DISTANCE_TYPES];

  for (const type of orderedTypes) {
    const t = byType[type];
    if (!t || t.count < 1) continue;

    const displayName = formatTypeName(type);

    if (DURATION_TYPES.includes(type)) {
      parts.push(
        `<span class="type-stat"><span class="type-name">${displayName}</span><span class="type-stat-values"><span class="stat-value">${t.count}</span><span class="stat-label">sessions</span> <span class="stat-value">${formatHours(t.moving_time_hours)}</span><span class="stat-label">hours</span></span></span>`
      );
    } else {
      if (t.distance_km < 1) continue;
      const elevPart =
        t.elevation_gain_meters > 0
          ? ` <span class="stat-value">${formatNumber(t.elevation_gain_meters)}</span><span class="stat-label">m</span>`
          : "";
      parts.push(
        `<span class="type-stat"><span class="type-name">${displayName}</span><span class="type-stat-values"><span class="stat-value">${t.count}</span><span class="stat-label">sessions</span> <span class="stat-value">${formatNumber(t.distance_km)}</span><span class="stat-label">km</span>${elevPart}</span></span>`
      );
    }
  }

  return parts.join("\n    ");
}

function renderMonth(year: number, month: number, days: DayActivities): string {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();

  const headerCells = DAY_ABBREV.map((d) => `<div class="calendar-header">${d}</div>`).join("");
  const dayCells = renderCalendarDays(startWeekday, daysInMonth, days);

  return `<div class="month">
      <div class="month-header">${MONTH_NAMES[month - 1]}</div>
      <div class="calendar">
        ${headerCells}
        ${dayCells}
      </div>
    </div>`;
}

function renderCalendarDays(startWeekday: number, daysInMonth: number, activityDays: DayActivities): string {
  const cells: string[] = [];

  // Empty cells for padding
  for (let i = 0; i < startWeekday; i++) {
    cells.push('<div class="day empty"></div>');
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const activities = activityDays[day];
    if (activities && activities.length > 0) {
      const primaryType = activities[0].type;
      const iconName = ACTIVITY_ICONS[primaryType] || DEFAULT_ICON;
      const badge = activities.length > 1 ? `<span class="badge">${activities.length}</span>` : "";
      const typesList = activities.map((a) => a.type).join(", ");
      cells.push(
        `<div class="day has-activity"><i data-lucide="${iconName}"></i>${badge}<span class="tooltip">${typesList}</span></div>`
      );
    } else {
      cells.push(`<div class="day">${day}</div>`);
    }
  }

  return cells.join("\n        ");
}

function renderFooter(totals: Totals): string {
  return `<footer>
    <div class="totals">
      <div class="stat-block">
        <span class="stat-block-label">All Time</span>
        <span class="stat-block-values"><span class="stat-value">${totals.count}</span><span class="stat-label">activities</span> <span class="stat-value">${formatHours(totals.moving_time_hours)}</span><span class="stat-label">hours</span></span>
      </div>
      ${renderTypeStats(totals.by_type)}
    </div>
  </footer>`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, "0")}, ${d.getFullYear()}`;
}

function formatNumber(num: number): string {
  return Math.round(num).toLocaleString("en-US");
}

function formatHours(hours: number): string {
  return Math.round(hours).toString();
}

function formatTypeName(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}
