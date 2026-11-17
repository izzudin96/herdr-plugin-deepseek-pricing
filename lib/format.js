import { PRICE_KEYS, PRICE_LABELS } from "./prices.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";

function paint(text, code, enabled) {
  return enabled ? `${code}${text}${RESET}` : text;
}

export function formatUtc(date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

export function formatCountdown(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (days === 0 && hours === 0 && secs > 0) parts.push(`${secs}s`);
  return parts.length > 0 ? parts.join(" ") : "0s";
}

function reasonText(report) {
  switch (report.reason) {
    case "holiday":
      return "Chinese public holiday";
    case "weekend":
      return "weekend";
    case "window":
      return `inside ${report.window.label}`;
    case "outside-window":
      return "outside peak windows";
    default:
      return report.reason;
  }
}

function formatTable(report, color) {
  const rows = PRICE_KEYS.map((key) => [
    PRICE_LABELS[key],
    report.prices.peak[key],
    report.prices.offPeak[key],
  ]);
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const priceWidth = Math.max(
    "OFF-PEAK".length,
    ...rows.flatMap(([, peak, offPeak]) => [
      `$${peak}`.length,
      `$${offPeak}`.length,
    ]),
  );

  const header = `${"".padEnd(labelWidth)}  ${"PEAK".padStart(priceWidth)}  ${"OFF-PEAK".padStart(priceWidth)}`;
  const lines = [paint(header, BOLD, color)];
  for (const [label, peak, offPeak] of rows) {
    lines.push(
      `${label.padEnd(labelWidth)}  ${`$${peak}`.padStart(priceWidth)}  ${`$${offPeak}`.padStart(priceWidth)}`,
    );
  }
  return lines.join("\n");
}

function formatCompact(report, color) {
  const peak = report.prices.peak;
  const offPeak = report.prices.offPeak;
  return [
    `${paint("PEAK", BOLD, color)}      $${peak.inputCacheHit} / $${peak.inputCacheMiss} / $${peak.output}`,
    `${paint("OFF-PEAK", BOLD, color)}  $${offPeak.inputCacheHit} / $${offPeak.inputCacheMiss} / $${offPeak.output}`,
    paint("(in-hit / in-miss / out)", DIM, color),
  ].join("\n");
}

export function formatStatus(report, { color = false, width = 80, footer = "" } = {}) {
  const isPeak = report.state === "peak";
  const stateText = isPeak ? "PEAK" : "OFF-PEAK";
  const stateColored = paint(stateText, isPeak ? `${BOLD}${RED}` : `${BOLD}${GREEN}`, color);

  const lines = [
    `${paint("DeepSeek pricing", BOLD, color)} — ${report.model}`,
    `${paint("Billing model:", DIM, color)} ${report.modelVersion}`,
    "",
    `${paint("Now:", DIM, color)}   ${formatUtc(new Date(report.nowUtc))}`,
    `${paint("Local:", DIM, color)} ${report.nowLocal}`,
    `${paint("State:", DIM, color)} ${stateColored}  ${paint(`(${reasonText(report)})`, DIM, color)}`,
    `${paint("Next:", DIM, color)}  ${report.nextState.toUpperCase()} at ${formatUtc(new Date(report.nextAtUtc))} ${paint(`(in ${formatCountdown(report.nextInSeconds)})`, DIM, color)}`,
    "",
  ];

  lines.push(width >= 68 ? formatTable(report, color) : formatCompact(report, color));
  lines.push("");
  lines.push(
    paint(
      `Prices in ${report.currency} ${report.unit}; off-peak is half of peak.`,
      DIM,
      color,
    ),
  );

  if (footer) {
    lines.push("");
    lines.push(paint(footer, DIM, color));
  }

  return lines.join("\n");
}
