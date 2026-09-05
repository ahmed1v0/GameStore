export type MoneyValue = {
  amount: string;
  currencyCode: string;
  minorUnit: number;
};

export type MoneyTotal = {
  amount: string;
  currencyCode: string;
  minorUnit: number;
};

function assertMinorUnit(minorUnit: number): void {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) {
    throw new RangeError("minorUnit must be an integer between 0 and 6");
  }
}

function scaleFor(minorUnit: number): bigint {
  let scale = BigInt(1);
  for (let index = 0; index < minorUnit; index += 1) {
    scale *= BigInt(10);
  }
  return scale;
}

function toMinorUnits(amount: string, minorUnit: number): bigint {
  assertMinorUnit(minorUnit);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new TypeError(`Invalid decimal amount: ${amount}`);

  const whole = match[1];
  const fraction = match[2] ?? "";
  const extraPrecision = fraction.slice(minorUnit);
  if (/[1-9]/.test(extraPrecision)) {
    throw new RangeError(`Amount ${amount} exceeds ${minorUnit} decimal places`);
  }

  const normalizedFraction = fraction.slice(0, minorUnit).padEnd(minorUnit, "0");
  const fractionalMinorUnits = normalizedFraction ? BigInt(normalizedFraction) : BigInt(0);
  return BigInt(whole) * scaleFor(minorUnit) + fractionalMinorUnits;
}

function fromMinorUnits(value: bigint, minorUnit: number): string {
  assertMinorUnit(minorUnit);
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  if (minorUnit === 0) return `${negative ? "-" : ""}${absolute}`;

  const digits = absolute.toString().padStart(minorUnit + 1, "0");
  const whole = digits.slice(0, -minorUnit);
  const fraction = digits.slice(-minorUnit);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function moneyInputStep(minorUnit: number): string {
  assertMinorUnit(minorUnit);
  return minorUnit === 0 ? "1" : `0.${"0".repeat(minorUnit - 1)}1`;
}

export function formatMoney(
  amount: string,
  currencyCode: string,
  minorUnit?: number,
): string {
  const normalized =
    minorUnit === undefined ? amount : fromMinorUnits(toMinorUnits(amount, minorUnit), minorUnit);
  return `${normalized} ${currencyCode}`;
}

export function sumMoneyByCurrency(values: MoneyValue[]): MoneyTotal[] {
  const totals = new Map<string, { minorUnit: number; total: bigint }>();

  for (const value of values) {
    const current = totals.get(value.currencyCode);
    if (current && current.minorUnit !== value.minorUnit) {
      throw new Error(`Inconsistent minor unit for ${value.currencyCode}`);
    }
    const amount = toMinorUnits(value.amount, value.minorUnit);
    totals.set(value.currencyCode, {
      minorUnit: value.minorUnit,
      total: (current?.total ?? BigInt(0)) + amount,
    });
  }

  return Array.from(totals, ([currencyCode, value]) => ({
    currencyCode,
    minorUnit: value.minorUnit,
    amount: fromMinorUnits(value.total, value.minorUnit),
  }));
}
