interface AnnualStatement {
  date?: string;
  totalRevenue?: string | number | null;
  netIncome?: string | number | null;
  freeCashFlow?: string | number | null;
  totalCashFromOperatingActivities?: string | number | null;
  capitalExpenditures?: string | number | null;
  epsActual?: string | number | null;
}

interface FinancialStatement {
  currency_symbol?: string | null;
  yearly?: Record<string, AnnualStatement | null>;
}

interface ProviderFundamentals {
  Financials?: {
    Income_Statement?: FinancialStatement;
    Cash_Flow?: FinancialStatement;
  };
  Earnings?: {
    Annual?: Record<string, AnnualStatement | null>;
  };
}

interface FiscalYear {
  date: string;
  revenue: number | null;
  netIncome: number | null;
  netMargin: number | null;
  eps: number | null;
  freeCashFlow: number | null;
}

export interface Fundamentals {
  latest: FiscalYear;
  prior?: FiscalYear;
  incomeCurrency?: string;
  cashFlowCurrency?: string;
  epsGrowth: number | null;
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function byDate(entries?: Record<string, AnnualStatement | null> | null) {
  const rows = new Map<string, AnnualStatement>();
  for (const [key, row] of Object.entries(entries ?? {})) {
    const date = row?.date ?? key;
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const parsed = new Date(date);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date)) {
      rows.set(date, row);
    }
  }
  return rows;
}

export function summarizeFundamentals(data: ProviderFundamentals): Fundamentals | null {
  const incomeStatement = data?.Financials?.Income_Statement;
  const cashFlowStatement = data?.Financials?.Cash_Flow;
  const income = byDate(incomeStatement?.yearly);
  const cashFlow = byDate(cashFlowStatement?.yearly);
  const earnings = byDate(data?.Earnings?.Annual);

  const dates = [...new Set([...income.keys(), ...cashFlow.keys(), ...earnings.keys()])]
    .sort((a, b) => b.localeCompare(a));
  const years = dates.map((date): FiscalYear => {
    const revenue = numeric(income.get(date)?.totalRevenue);
    const netIncome = numeric(income.get(date)?.netIncome);
    const cash = cashFlow.get(date);
    const operatingCash = numeric(cash?.totalCashFromOperatingActivities);
    const capitalSpend = numeric(cash?.capitalExpenditures);

    return {
      date,
      revenue,
      netIncome,
      netMargin: revenue !== null && revenue > 0 && netIncome !== null ? netIncome / revenue : null,
      eps: numeric(earnings.get(date)?.epsActual),
      freeCashFlow: numeric(cash?.freeCashFlow) ?? (
        operatingCash !== null && capitalSpend !== null ? operatingCash - Math.abs(capitalSpend) : null
      ),
    };
  });

  const latest = years.find(({ revenue, netIncome, eps, freeCashFlow }) =>
    [revenue, netIncome, eps, freeCashFlow].some((value) => value !== null)
  );
  if (!latest) return null;

  const prior = years.find(({ date }) => {
    const days = (Date.parse(latest.date) - Date.parse(date)) / 86_400_000;
    return days >= 350 && days <= 380;
  });

  const priorEps = prior?.eps;
  return {
    latest,
    prior,
    incomeCurrency: incomeStatement?.currency_symbol || undefined,
    cashFlowCurrency: cashFlowStatement?.currency_symbol || undefined,
    epsGrowth: latest.eps !== null && priorEps != null && priorEps > 0
      ? (latest.eps - priorEps) / priorEps
      : null,
  };
}

export async function loadFundamentals(symbol: string) {
  const token = process.env.EODHD_FUNDAMENTALS_API_KEY;
  if (!token) {
    return { error: "Company fundamentals aren’t configured for this deployment." };
  }

  const url = new URL(`https://eodhd.com/api/v1.1/fundamentals/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    api_token: token,
    fmt: "json",
    filter: "Financials,Earnings",
  }).toString();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), redirect: "error" });
    if (response.status === 404) return { error: "No annual fundamentals are available for this stock." };
    if (!response.ok) return { error: "The fundamentals provider is unavailable. Try again later." };

    const annual = summarizeFundamentals(await response.json());
    return annual ? { annual } : { error: "No annual fundamentals are available for this stock." };
  } catch {
    return { error: "The fundamentals provider is unavailable. Try again later." };
  }
}
