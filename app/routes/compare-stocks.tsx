import type { Route } from "./+types/compare-stocks";
import {
  fetchComparisonReport,
  fetchTickerData,
} from "~/api/ticker";
import { useState } from "react";
import {
  useFetcher,
  useRouteLoaderData,
  type ActionFunctionArgs,
} from "react-router";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { DatePickerWithRange } from "~/components/ui/date-picker";
import LoadingDots from "./components/LoadingDots";
import { AppHeader } from "~/components/app-header";
import { ReportContent } from "~/components/report-content";
import { formatDate } from "~/utils/dates";
import { cn } from "~/lib/utils";
import type { Ticker } from "~/utils/interface";
import type { RootLoaderData } from "~/root";

interface PriceRow {
  date: string;
  close?: string | number;
  adjusted_close?: string | number;
}

interface StockSummary {
  ticker: Ticker;
  close: number | null;
  change: number | null;
  adjusted: boolean;
}

interface CompareStocksActionData {
  content?: string;
  error?: string;
  results?: StockSummary[];
  startDate?: string;
  endDate?: string;
}

const tickerKey = (ticker: Ticker) => `${ticker.Code}.${ticker.Exchange}`;

function numericPrice(value: string | number | undefined) {
  if (value == null || value === "") return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function summarize(ticker: Ticker, data: PriceRow[]): StockSummary {
  const rows = data.filter((row) => row && typeof row.date === "string")
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = rows[0];
  const last = rows.at(-1);
  const firstAdjusted = numericPrice(first?.adjusted_close);
  const lastAdjusted = numericPrice(last?.adjusted_close);
  const adjusted = firstAdjusted !== null && lastAdjusted !== null;
  const start = adjusted ? firstAdjusted : numericPrice(first?.close);
  const end = adjusted ? lastAdjusted : numericPrice(last?.close);

  return {
    ticker,
    close: numericPrice(last?.close),
    change: rows.length > 1 && start !== null && start > 0 && end !== null
      ? ((end - start) / start) * 100
      : null,
    adjusted,
  };
}

const priceFormat = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const changeFormat = new Intl.NumberFormat("en-NG", {
  style: "percent",
  signDisplay: "exceptZero",
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat("en-NG", {
  timeZone: "UTC",
  dateStyle: "medium",
});

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

const isTicker = (value: unknown): value is Ticker => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.Name === "string" &&
    typeof candidate.Code === "string" &&
    typeof candidate.Exchange === "string" &&
    typeof candidate.Currency === "string"
  );
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Compare Stocks | Stock AI" },
    {
      name: "description",
      content:
        "Compare multiple stocks side by side and get an AI-generated investment analysis.",
    },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const selectedTickersValue = formData.get("selectedTickers");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (
    typeof selectedTickersValue !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string"
  ) {
    return Response.json(
      { error: "Invalid comparison request." },
      { status: 400 }
    );
  }

  let selectedTickers: Ticker[];

  try {
    const parsedTickers = JSON.parse(selectedTickersValue);

    if (!Array.isArray(parsedTickers) || !parsedTickers.every(isTicker)) {
      return Response.json(
        { error: "Please select at least two valid stocks to compare." },
        { status: 400 }
      );
    }

    selectedTickers = parsedTickers;
  } catch {
    return Response.json(
      { error: "Unable to read the selected stocks." },
      { status: 400 }
    );
  }

  const uniqueTickers = new Set(selectedTickers.map(tickerKey));
  if (uniqueTickers.size < 2 || uniqueTickers.size !== selectedTickers.length) {
    return Response.json(
      { error: "Please select at least two distinct stocks to compare." },
      { status: 400 }
    );
  }

  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
    return Response.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  try {
    const stockHistoricalData = await Promise.all(
      selectedTickers.map(async (selectedTicker) => {
        const response = await fetchTickerData({
          code: selectedTicker.Code,
          exchange: selectedTicker.Exchange,
          startDate,
          endDate,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${selectedTicker.Name}.`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error(`Price data is unavailable for ${selectedTicker.Code}.`);
        }
        return payload;
      })
    );

    const comparisonData = selectedTickers.map((selectedTicker, index) => ({
      ticker: selectedTicker.Name,
      code: selectedTicker.Code,
      exchange: selectedTicker.Exchange,
      currency: selectedTicker.Currency,
      data: stockHistoricalData[index],
    }));

    const results = comparisonData.map(({ data }, index) =>
      summarize(selectedTickers[index], data)
    );
    const summary = { results, startDate, endDate };
    if (comparisonData.every(({ data }) => data.length === 0)) {
      return { ...summary, error: "No trading data was returned for this period." };
    }

    const report = await fetchComparisonReport({
      reportType: "comparison",
      data: JSON.stringify(comparisonData),
      code: selectedTickers.map((selectedTicker) => selectedTicker.Code).join(", "),
      ticker: selectedTickers
        .map((selectedTicker) => selectedTicker.Name)
        .join(" vs "),
      currency: Array.from(
        new Set(selectedTickers.map((selectedTicker) => selectedTicker.Currency))
      ).join(", "),
      startDate,
      endDate,
      comparisonTickers: selectedTickers,
    }).catch(() => null);
    const reportPayload = await report?.json().catch(() => null);

    const content = report?.ok && typeof reportPayload?.content === "string"
      ? reportPayload.content.trim()
      : "";

    return content
      ? { ...summary, content }
      : { ...summary, error: "The AI analysis is temporarily unavailable." };
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate comparison report.",
      },
      { status: 500 }
    );
  }
}

export default function CompareStocks() {
  const fetcher = useFetcher<CompareStocksActionData>();
  const rootLoaderData = useRouteLoaderData<RootLoaderData>("root");
  const stockList = rootLoaderData?.stockList ?? [];
  const [open, setOpen] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<Ticker[]>([]);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 14),
    to: new Date(),
  });

  const pending = fetcher.state !== "idle";
  const result = pending ? undefined : fetcher.data;

  const toggleTicker = (ticker: Ticker) => {
    setSelectedTickers((currentTickers) => {
      const alreadySelected = currentTickers.some(
        (selectedTicker) => tickerKey(selectedTicker) === tickerKey(ticker)
      );

      if (alreadySelected) {
        return currentTickers.filter(
          (selectedTicker) => tickerKey(selectedTicker) !== tickerKey(ticker)
        );
      }

      return [...currentTickers, ticker];
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-3xl border border-emerald-900/30 bg-emerald-950 px-6 py-8 text-emerald-50 sm:px-10 sm:py-12">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Compare stocks
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-emerald-100/85">
            See how selected stocks performed over the same period and get an AI analysis of their performance and risk.
          </p>
        </section>

        <fetcher.Form method="post" className="space-y-5 rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
          <input
            type="hidden"
            name="selectedTickers"
            value={JSON.stringify(selectedTickers)}
          />
          <input
            type="hidden"
            name="startDate"
            value={date?.from ? formatDate(date.from) : ""}
          />
          <input
            type="hidden"
            name="endDate"
            value={date?.to ? formatDate(date.to) : ""}
          />

          <div className="space-y-2">
            <label htmlFor="compare-stock-picker" className="text-sm font-medium">Stocks</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="compare-stock-picker"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  <span className="truncate">
                    {selectedTickers.length > 0
                      ? `${selectedTickers.length} stock${
                          selectedTickers.length > 1 ? "s" : ""
                        } selected`
                      : "Search and select at least two stocks"}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
                <Command label="Search by company or ticker">
                  <CommandInput
                    placeholder="Search by company or ticker"
                    className="h-9 text-sm"
                  />
                  <CommandList>
                    <CommandEmpty>No stock found.</CommandEmpty>
                    <CommandGroup>
                      {stockList.map((ticker: Ticker) => {
                        const isSelected = selectedTickers.some(
                          (selectedTicker) => tickerKey(selectedTicker) === tickerKey(ticker)
                        );

                        return (
                          <CommandItem
                            key={tickerKey(ticker)}
                            className="cursor-pointer"
                            value={`${ticker.Name} ${tickerKey(ticker)}`}
                            onSelect={() => {
                              toggleTicker(ticker);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{ticker.Name}</span>
                              <span className="text-xs text-muted-foreground">
                                {ticker.Code} - {ticker.Exchange}
                              </span>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedTickers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTickers.map((ticker) => (
                <button
                  key={tickerKey(ticker)}
                  type="button"
                  onClick={() => toggleTicker(ticker)}
                  aria-label={`Remove ${ticker.Name}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="truncate">
                    {ticker.Name} ({ticker.Code})
                  </span>
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium">Date range</legend>
              <DatePickerWithRange date={date} setDate={setDate} />
            </fieldset>

            <Button
              type="submit"
              disabled={
                pending || selectedTickers.length < 2 || !date?.from || !date?.to
              }
              className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {pending ? "Comparing…" : "Compare stocks"}
            </Button>
          </div>
        </fetcher.Form>

        {pending && (
          <div role="status" className="flex items-center gap-3 rounded-2xl border p-5">
            <span>Fetching prices and generating the report</span>
            <LoadingDots />
          </div>
        )}

        {result?.error && (
          <p role="alert" className="rounded-2xl border border-destructive/40 p-5">
            {result.error}
          </p>
        )}

        {result?.results && result.startDate && result.endDate && (
          <section aria-labelledby="comparison-results" className="space-y-4">
            <div>
              <h2 id="comparison-results" className="text-2xl font-semibold tracking-tight">Price comparison</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dateFormat.formatRange(new Date(result.startDate), new Date(result.endDate))}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.results.map(({ ticker, close, change, adjusted }) => (
                <li key={tickerKey(ticker)} className="rounded-2xl border bg-card p-5 text-card-foreground">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {tickerKey(ticker)}
                  </p>
                  <h3 className="mt-1 font-semibold">{ticker.Name}</h3>
                  <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">Last close</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {close === null ? "Unavailable" : `${ticker.Currency} ${priceFormat.format(close)}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {adjusted ? "Adjusted change" : "Price change"}
                      </dt>
                      <dd className={cn(
                        "mt-1 font-semibold tabular-nums",
                        change !== null && change > 0 && "text-emerald-700 dark:text-emerald-400",
                        change !== null && change < 0 && "text-red-700 dark:text-red-400"
                      )}>
                        {change === null ? "Unavailable" : changeFormat.format(change / 100)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result?.content && (
          <section aria-labelledby="comparison-report" className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
            <h2 id="comparison-report" className="mb-4 text-2xl font-semibold tracking-tight">AI analysis</h2>
            <ReportContent report={result.content} />
          </section>
        )}
      </main>
    </div>
  );
}
