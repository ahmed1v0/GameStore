import { expect, it } from "vitest";

import { formatMoney, moneyInputStep, sumMoneyByCurrency } from "@/lib/money";

it("formats amounts using the currency minor unit without binary floating point", () => {
  expect(formatMoney("10.120", "SAR", 2)).toBe("10.12 SAR");
  expect(formatMoney("10.120", "JOD", 3)).toBe("10.120 JOD");
  expect(moneyInputStep(3)).toBe("0.001");
  expect(moneyInputStep(2)).toBe("0.01");
});

it("sums decimal strings exactly and keeps currencies separate", () => {
  const totals = sumMoneyByCurrency([
    { amount: "0.100", currencyCode: "JOD", minorUnit: 3 },
    { amount: "0.200", currencyCode: "JOD", minorUnit: 3 },
    { amount: "0.10", currencyCode: "SAR", minorUnit: 2 },
    { amount: "0.20", currencyCode: "SAR", minorUnit: 2 },
  ]);

  expect(totals).toEqual([
    { amount: "0.300", currencyCode: "JOD", minorUnit: 3 },
    { amount: "0.30", currencyCode: "SAR", minorUnit: 2 },
  ]);
});

it("rejects non-zero precision beyond the configured minor unit", () => {
  expect(() => formatMoney("1.234", "SAR", 2)).toThrow(/exceeds 2 decimal places/);
});
