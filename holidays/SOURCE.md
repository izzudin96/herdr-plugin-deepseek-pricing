# Holiday data source

`2026.json` and `2027.json` are copied from
[NateScarlet/holiday-cn](https://github.com/NateScarlet/holiday-cn), which
publishes Chinese statutory holiday and make-up workday data from State Council
announcements.

- License: MIT (see `LICENSE`).
- Source of truth: the `papers` URL inside each JSON file.
- Refresh: download the next year's file into this directory. The tool fails
  loudly when a year is missing.
