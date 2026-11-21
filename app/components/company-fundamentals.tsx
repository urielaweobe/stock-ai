import type { Fundamentals } from "~/api/fundamentals.server";

const dateFormat = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" });
const amountFormat = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("en-NG", { style: "percent", maximumFractionDigits: 2 });
const growthFormat = new Intl.NumberFormat("en-NG", {
  style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero",
});

function amount(value: number | null | undefined, currency?: string) {
  if (value == null) return "Unavailable";
  return currency ? `${currency} ${amountFormat.format(value)}` : amountFormat.format(value);
}

function margin(value: number | null | undefined) {
  return value == null ? "Unavailable" : percentFormat.format(value);
}

export function CompanyFundamentals({ data }: { data: Fundamentals }) {
  const { latest, prior, incomeCurrency, cashFlowCurrency, epsGrowth } = data;
  const metrics = [
    {
      label: "Revenue",
      current: amount(latest.revenue, incomeCurrency),
      previous: amount(prior?.revenue, incomeCurrency),
      description: "Income from the company’s business before expenses.",
    },
    {
      label: "Net income",
      current: amount(latest.netIncome, incomeCurrency),
      previous: amount(prior?.netIncome, incomeCurrency),
      description: "Profit or loss after expenses and taxes.",
    },
    {
      label: "Net profit margin",
      current: margin(latest.netMargin),
      previous: margin(prior?.netMargin),
      description: "The share of revenue kept as net income.",
    },
    {
      label: "EPS growth",
      current: epsGrowth === null ? "Unavailable" : growthFormat.format(epsGrowth),
      previous: null,
      description: `Reported earnings per share: ${amount(latest.eps)}${prior ? ` vs. ${amount(prior.eps)} in the prior year` : ""}. Growth requires positive prior-year EPS.`,
    },
    {
      label: "Free cash flow",
      current: amount(latest.freeCashFlow, cashFlowCurrency),
      previous: amount(prior?.freeCashFlow, cashFlowCurrency),
      description: "Cash from operations after capital spending.",
    },
  ];

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Fiscal year ended {dateFormat.format(new Date(latest.date))}
        {prior && ` · Prior year ended ${dateFormat.format(new Date(prior.date))}`}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ label, current, previous, description }) => (
          <div key={label} className="min-w-0 rounded-xl border bg-background p-4">
            <dt className="text-sm font-medium">{label}</dt>
            <dd className="mt-1 break-words text-lg font-semibold tabular-nums">{current}</dd>
            {prior && previous !== null && (
              <dd className="mt-1 break-words text-sm tabular-nums text-muted-foreground">
                Prior year {previous}
              </dd>
            )}
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Annual data from EODHD. The price-history dates apply to the stock report only.
      </p>
    </div>
  );
}
