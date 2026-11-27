// TUI half of the DeepSeek pricing plugin: peak / off-peak state, prices,
// account balance and today's token usage. Loaded through ~/.config/opencode/cli.json
// (or auto-discovered under ~/.config/opencode/plugins/).

const SHORT_LABELS = Object.freeze({
  inputCacheHit: "cache hit",
  inputCacheMiss: "cache miss",
  output: "output",
});

const LABEL_WIDTH = 10;
const CLOCK_MS = 15_000;
const ACCOUNT_MS = 60_000;

export default {
  id: "deepseek.pricing",
  async setup(context) {
    // Imported at runtime so the host resolves them, never this directory.
    const { Plugin } = await import("@opencode/plugin/tui");
    const { createSignal, Show } = await import("solid-js");
    const { loadPricing } = await import("../lib/config.js");
    const { createHolidayCalendar } = await import("../lib/calendar.js");
    const { buildReport } = await import("../lib/report.js");
    const { formatCountdown } = await import("../lib/format.js");
    const { PRICE_KEYS } = await import("../lib/prices.js");
    const { createAccountCache } = await import("../lib/account.js");

    const pricing = loadPricing();
    const calendar = createHolidayCalendar();
    const account = createAccountCache();

    // Fail loudly at setup if pricing or holiday data is broken.
    buildReport({ now: new Date(), pricing, calendar });

    return Plugin.define({
      id: "deepseek.pricing",
      setup(context) {
        const [clock, setClock] = createSignal(Date.now());
        const [accountState, setAccountState] = createSignal({
          balance: null,
          usage: null,
          error: null,
        });

        const pull = () => {
          account.get().then(setAccountState);
        };
        pull();

        const clockTimer = setInterval(() => setClock(Date.now()), CLOCK_MS);
        const accountTimer = setInterval(pull, ACCOUNT_MS);

        const report = () => buildReport({ now: new Date(clock()), pricing, calendar });
        const isPeak = () => report().state === "peak";
        const activeKey = () => (isPeak() ? "peak" : "offPeak");
        const otherKey = () => (isPeak() ? "offPeak" : "peak");
        const stateColor = () =>
          isPeak()
            ? context.theme.text.feedback.warning.base
            : context.theme.text.feedback.success.base;
        const money = (info) => (info === undefined ? "?" : info.total);

        const number = new Intl.NumberFormat("en-US");
        const cny = () => accountState().balance?.infos.find((info) => info.currency === "CNY");
        const openPanel = () => context.ui.panel.open("deepseek.pricing.account");

        function Panel() {
          return (
            <Show when={context.ui.panel.current()?.name === "deepseek.pricing.account"}>
              <box flexDirection="column">
                <box flexDirection="row" gap={1}>
                  <text fg={context.theme.text.base}>DeepSeek</text>
                  <text fg={stateColor()}>{isPeak() ? "PEAK" : "OFF-PEAK"}</text>
                  <text fg={context.theme.text.muted}>
                    {formatCountdown(report().nextInSeconds)} left in this rate
                  </text>
                </box>
                {PRICE_KEYS.map((key) => (
                  <text fg={context.theme.text.base}>
                    {`${SHORT_LABELS[key].padEnd(LABEL_WIDTH)} $${report().prices[activeKey()][key]}`}
                    <span style={{ fg: context.theme.text.muted }}>
                      {` ($${report().prices[otherKey()][key]})`}
                    </span>
                  </text>
                ))}
                <text fg={context.theme.text.muted}>
                  {`${pricing.modelVersion} · USD per 1M tokens`}
                </text>
                <text> </text>
                <text fg={context.theme.text.muted}>Account</text>
                <Show
                  when={accountState().balance !== null}
                  fallback={<text fg={context.theme.text.muted}>balance unavailable</text>}
                >
                  {accountState().balance.infos.map((info) => (
                    <text fg={context.theme.text.base}>
                      {`balance     ${info.currency} ${info.total}`}
                      <span style={{ fg: context.theme.text.muted }}>
                        {`  topped up ${info.toppedUp} · granted ${info.granted}`}
                      </span>
                    </text>
                  ))}
                </Show>
                <Show
                  when={accountState().usage !== null}
                  fallback={<text fg={context.theme.text.muted}>usage unavailable</text>}
                >
                  <text fg={context.theme.text.base}>
                    {`today       ${accountState().usage.messages} requests · ${number.format(
                      accountState().usage.tokens.total,
                    )} tokens · $${accountState().usage.cost.toFixed(4)}`}
                  </text>
                  <text fg={context.theme.text.muted}>
                    {`in ${number.format(accountState().usage.tokens.input)} · cache read ${number.format(
                      accountState().usage.tokens.cacheRead,
                    )} · out ${number.format(accountState().usage.tokens.output)}`}
                  </text>
                </Show>
                <Show when={accountState().error !== null}>
                  <text fg={context.theme.text.feedback.error.base}>{accountState().error}</text>
                </Show>
              </box>
            </Show>
          );
        }

        context.ui.toast.show({ message: "deepseek.pricing loaded", variant: "success" });

        const disposeFooter = context.ui.slot({
          prepend: "prompt.footer",
          render: () => (
            <box flexDirection="row" gap={1}>
              <text fg={stateColor()} onMouseDown={openPanel}>
                {isPeak() ? "PEAK" : "OFF-PEAK"}
              </text>
              <text fg={context.theme.text.muted} onMouseDown={openPanel}>
                {`¥${money(cny())}`}
              </text>
              <text fg={context.theme.text.muted} onMouseDown={openPanel}>
                {accountState().usage === null
                  ? "today ?"
                  : `today ${number.format(accountState().usage.tokens.total)} tok`}
              </text>
            </box>
          ),
        });

        const disposePanel = context.ui.slot({
          append: "session.panel",
          render: (panel) => (
            <Show when={panel.name === "deepseek.pricing.account"}>
              <Panel />
            </Show>
          ),
        });

        const disposeKeys = context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "deepseek.pricing.account",
              title: "DeepSeek account and usage",
              slash: { name: "deepseek" },
              run: openPanel,
            },
          ],
        }));

        return () => {
          clearInterval(clockTimer);
          clearInterval(accountTimer);
          disposeFooter();
          disposePanel();
          disposeKeys();
        };
      },
    });
  },
};
