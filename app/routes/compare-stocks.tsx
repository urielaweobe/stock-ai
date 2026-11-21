import type { Route } from "./+types/compare-stocks";
import {
  fetchComparisonReport,
  fetchTickerData,
} from "~/api/ticker";
import { useId, useRef, useState } from "react";
import {
  useFetcher,
  useRouteLoaderData,
  type ActionFunctionArgs,
} from "react-router";
import { Check, ChevronsUpDown, GitCompareArrows, RotateCcw, Sparkles, X } from "lucide-react";
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
  const formId = useId();
  const [resetCount, setResetCount] = useState(0);
  const fetcher = useFetcher<CompareStocksActionData>({ key: `${formId}-${resetCount}` });
  const stockPicker = useRef<HTMLButtonElement>(null);
  const rootLoaderData = useRouteLoaderData<RootLoaderData>("root");
  const stockList = rootLoaderData?.stockList ?? [];
  const [open, setOpen] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<Ticker[]>([]);
  const [defaultDate] = useState<DateRange>(() => {
    const today = new Date();
    return { from: subDays(today, 14), to: today };
  });
  const [date, setDate] = useState<DateRange | undefined>(defaultDate);

  const pending = fetcher.state !== "idle";
  const result = pending ? undefined : fetcher.data;
  const dateChanged = date?.from?.getTime() !== defaultDate.from?.getTime() ||
    date?.to?.getTime() !== defaultDate.to?.getTime();

  function clearComparison() {
    setSelectedTickers([]);
    setDate(defaultDate);
    setOpen(false);
    setResetCount((count) => count + 1);
    stockPicker.current?.focus();
  }

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
    <div className="workspace">
      <AppHeader />

      <main className="workspace-main">
        <section className="workspace-intro">
          <h1>Compare stocks</h1>
          <p>Put two or more stocks side by side to see how their prices moved over the same period.</p>
        </section>

        <fetcher.Form method="post" className="workspace-panel space-y-5">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label htmlFor="compare-stock-picker" className="text-sm font-medium">Stocks</label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="compare-stock-picker"
                    ref={stockPicker}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="workspace-field"
                  >
                    <span className="flex-1 truncate">
                      {selectedTickers.length
                        ? `${selectedTickers.length} selected`
                        : "Select at least two stocks"}
                    </span>
                    <ChevronsUpDown className="opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
                  <Command label="Search by company or ticker">
                    <CommandInput placeholder="Search by company or ticker" />
                    <CommandList>
                      <CommandEmpty>
                        {stockList.length ? "No matching stocks." : "Stock list unavailable. Reload to try again."}
                      </CommandEmpty>
                      <CommandGroup>
                        {stockList.map((ticker) => {
                          const isSelected = selectedTickers.some(
                            (selectedTicker) => tickerKey(selectedTicker) === tickerKey(ticker)
                          );

                          return (
                            <CommandItem
                              key={tickerKey(ticker)}
                              className="cursor-pointer"
                              value={`${ticker.Name} ${tickerKey(ticker)}`}
                              onSelect={() => toggleTicker(ticker)}
                            >
                              <div className="flex flex-1 flex-col">
                                <span>{ticker.Name}</span>
                                <span className="text-xs text-muted-foreground">{tickerKey(ticker)}</span>
                              </div>
                              {isSelected && (
                                <>
                                  <span className="sr-only">Added to comparison</span>
                                  <Check aria-hidden="true" />
                                </>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium">Date range</legend>
              <DatePickerWithRange date={date} setDate={setDate} />
            </fieldset>
          </div>

          {selectedTickers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTickers.map((ticker) => (
                <button
                  key={tickerKey(ticker)}
                  type="button"
                  onClick={() => toggleTicker(ticker)}
                  aria-label={`Remove ${ticker.Name}`}
                  className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border bg-muted px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="truncate">
                    {ticker.Name} ({ticker.Code})
                  </span>
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={clearComparison}
              disabled={!selectedTickers.length && !dateChanged && !fetcher.data && !pending}
              className="h-11 rounded-xl"
            >
              <RotateCcw aria-hidden="true" />
              Clear
            </Button>
            <Button
              type="submit"
              disabled={pending || selectedTickers.length < 2 || !date?.from || !date?.to}
              className="workspace-primary"
            >
              <Sparkles aria-hidden="true" />
              {pending ? "Comparing…" : "Compare stocks"}
            </Button>
          </div>
        </fetcher.Form>

        {pending && (
          <div role="status" className="workspace-panel">
            Fetching prices and generating the report…
          </div>
        )}

        {result?.error && (
          <p role="alert" className="workspace-panel border-destructive/40">
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
                <li key={tickerKey(ticker)} className="workspace-panel">
                  <p className="font-mono text-sm font-semibold text-indigo-700 dark:text-indigo-400">
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
          <section aria-labelledby="comparison-report" className="workspace-panel">
            <h2 id="comparison-report" className="mb-4 text-2xl font-semibold tracking-tight">AI analysis</h2>
            <ReportContent report={result.content} />
          </section>
        )}
        {!pending && !result && (
          <section className="workspace-empty">
            <GitCompareArrows className="size-6 text-indigo-700 dark:text-indigo-400" aria-hidden="true" />
            <h2 className="mt-1 font-semibold">Start a comparison</h2>
            <p className="text-sm text-muted-foreground">Your price comparison and AI analysis will appear here.</p>
          </section>
        )}
      </main>
    </div>
  );
}
