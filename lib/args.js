export function parseArgs(argv) {
  const options = {
    json: false,
    color: true,
    at: null,
    pricing: null,
    holidays: null,
    intervalMs: null,
    help: false,
  };

  function takeValue(index, flag) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--no-color":
        options.color = false;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--at": {
        const value = takeValue(i, arg);
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error(`invalid --at value: ${value}`);
        }
        options.at = date;
        i += 1;
        break;
      }
      case "--pricing":
        options.pricing = takeValue(i, arg);
        i += 1;
        break;
      case "--holidays":
        options.holidays = takeValue(i, arg);
        i += 1;
        break;
      case "--interval": {
        const value = Number(takeValue(i, arg));
        if (!Number.isFinite(value) || value < 250) {
          throw new Error("--interval must be at least 250 milliseconds");
        }
        options.intervalMs = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}
