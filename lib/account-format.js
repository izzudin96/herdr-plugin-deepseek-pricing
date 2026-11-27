const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function paint(text, code, enabled) {
  return enabled ? `${code}${text}${RESET}` : text;
}

const number = new Intl.NumberFormat("en-US");

export function formatAccount(account, { color = false } = {}) {
  if (account === null) return "";

  const lines = [];
  if (account.balance !== null) {
    const cny = account.balance.infos.find((info) => info.currency === "CNY");
    const usd = account.balance.infos.find((info) => info.currency === "USD");
    const primary = cny === undefined ? usd : cny;
    if (primary !== undefined) {
      lines.push(
        `${paint("Balance:", DIM, color)} ${primary.currency} ${primary.total} ${paint(`(topped up ${primary.toppedUp}, granted ${primary.granted})`, DIM, color)}`,
      );
    } else {
      lines.push(`${paint("Balance:", DIM, color)} unavailable (no CNY or USD entry)`);
    }
  } else {
    lines.push(`${paint("Balance:", DIM, color)} unavailable`);
  }

  if (account.usage !== null) {
    const { tokens, cost, messages } = account.usage;
    lines.push(
      `${paint("Today:", DIM, color)}   ${number.format(tokens.total)} tokens, $${cost.toFixed(4)} across ${messages} requests`,
    );
    lines.push(
      paint(
        `         in ${number.format(tokens.input)} · cache read ${number.format(tokens.cacheRead)} · out ${number.format(tokens.output)} · reasoning ${number.format(tokens.reasoning)}`,
        DIM,
        color,
      ),
    );
  } else {
    lines.push(`${paint("Today:", DIM, color)}   unavailable`);
  }

  if (account.error) {
    lines.push(paint(`         ${account.error}`, DIM, color));
  }

  return `${paint("Account", BOLD, color)}\n${lines.join("\n")}`;
}
