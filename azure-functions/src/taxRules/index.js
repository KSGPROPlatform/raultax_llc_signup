// Per-year rules resolver. A year without a verified rules file CANNOT be
// computed — the engine flags it instead of guessing (docs/1040-mapping.md
// hard rule). Add 2024/2023/2022 files here once their constants are verified.
const RULES = {
  2025: require("./2025"),
};

function getRules(year) {
  return RULES[Number(year)] ?? null;
}

module.exports = { getRules, supportedYears: Object.keys(RULES).map(Number) };
