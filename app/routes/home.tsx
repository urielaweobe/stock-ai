import type { Route } from "./+types/home";
import { fetchReport, fetchTickerData } from "~/api/ticker";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { ChartCandlestick, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { cn } from "~/lib/utils";
import {
  useFetcher,
  useRouteLoaderData,
  type ActionFunctionArgs,
  type ShouldRevalidateFunction,
} from "react-router";
import type { Ticker } from "~/utils/interface";
import { DatePickerWithRange } from "~/components/ui/date-picker";
import type { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { AppHeader } from "~/components/app-header";
import { ReportContent } from "~/components/report-content";
import { formatDate } from "~/utils/dates";
import type { RootLoaderData } from "~/root";

interface HomeActionData {
  content?: string;
  error?: string;
  currency?: string;
  ticker?: string;
  latestPrice?: {
    open?: string;
    close?: string;
    adjusted_close?: string;
    high?: string;
    low?: string;
  } | null;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stock AI" },
    {
      name: "description",
      content: "Learn about the performance of the stock you want to buy next!",
    },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const code = formData.get("code");
  const exchange = formData.get("exchange");
  const ticker = formData.get("ticker");
  const currency = formData.get("currency");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (
    typeof code !== "string" ||
    typeof exchange !== "string" ||
    typeof ticker !== "string" ||
    typeof currency !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string"
  ) {
    return Response.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    const response = await fetchTickerData({
      code,
      exchange,
      startDate: startDate.slice(0, 10),
      endDate: endDate.slice(0, 10),
    });
    if (!response.ok) {
      return Response.json(
        { error: "Failed to fetch stock data" },
        { status: response.status }
      );
    }

    const stockHistoricalData = await response.json();
    const report = await fetchReport({
      data: JSON.stringify(stockHistoricalData),
      code,
      ticker,
      currency,
      startDate: startDate.slice(0, 10),
      endDate: endDate.slice(0, 10),
    });
    const reportPayload = await report.json().catch(() => null);

    if (!report.ok || typeof reportPayload?.content !== "string") {
      return Response.json(
        {
          error:
            typeof reportPayload?.error === "string"
              ? reportPayload.error
              : "Failed to generate report",
        },
        { status: report.ok ? 502 : report.status }
      );
    }

    return { content: reportPayload.content, currency, ticker, latestPrice: stockHistoricalData.at(-1) ?? null };
  } catch (error) {
    return Response.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

export default function Home() {
  const fetcher = useFetcher<HomeActionData>();
  const rootLoaderData = useRouteLoaderData<RootLoaderData>("root");
  const stockList = rootLoaderData?.stockList ?? [];
  const [open, setOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<Ticker | undefined>();
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 3),
    to: new Date(),
  });

  const pending = fetcher.state !== "idle";
  const result = pending ? undefined : fetcher.data;
  const prices = result?.latestPrice;
  const metrics = [
    ["Open", prices?.open],
    ["Close", prices?.close],
    ["Adjusted close", prices?.adjusted_close],
    ["High", prices?.high],
    ["Low", prices?.low],
  ] as const;

  return (
    <div className="workspace">
      <AppHeader />

      <main className="workspace-main">
        <section className="workspace-intro">
          <h1>Research a stock</h1>
          <p>Explore historical prices and get an AI summary of how a Nigerian stock performed over a period you choose.</p>
        </section>

        <fetcher.Form method="post" className="workspace-panel">
          <input type="hidden" name="code" value={selectedTicker?.Code} />
          <input
            type="hidden"
            name="exchange"
            value={selectedTicker?.Exchange}
          />
          <input type="hidden" name="ticker" value={selectedTicker?.Name} />
          <input
            type="hidden"
            name="currency"
            value={selectedTicker?.Currency}
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
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0 space-y-2">
              <label htmlFor="research-stock-picker" className="text-sm font-medium">Stock</label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger className="cursor-pointer w-full" asChild>
                  <Button
                    id="research-stock-picker"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="workspace-field"
                    disabled={pending}
                  >
                    <span className="flex-1 truncate">
                      {selectedTicker ? `${selectedTicker.Name} (${selectedTicker.Code})` : "Select a stock"}
                    </span>
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
                  <Command label="Search by company or ticker">
                    <CommandInput
                      placeholder="Search by company or ticker"
                      className="h-9 text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>{stockList.length ? "No matching stocks." : "Stock list unavailable. Reload to try again."}</CommandEmpty>
                      <CommandGroup>
                        {stockList.map((ticker: Ticker) => (
                          <CommandItem
                            className="cursor-pointer"
                            key={`${ticker.Code}.${ticker.Exchange}`}
                            value={`${ticker.Name} ${ticker.Code} ${ticker.Exchange}`}
                            onSelect={() => {
                              setSelectedTicker(ticker);
                              setOpen(false);
                            }}
                          >
                            <span className="flex-1">{ticker.Name}</span>
                            <span className="text-xs text-muted-foreground">{ticker.Code}</span>
                            <Check
                              className={cn(
                                "ml-auto",
                                selectedTicker?.Code === ticker.Code && selectedTicker?.Exchange === ticker.Exchange
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <fieldset disabled={pending} className="min-w-0">
              <legend className="mb-2 text-sm font-medium">Date range</legend>
              <DatePickerWithRange date={date} setDate={setDate} />
            </fieldset>

            <Button type="submit" disabled={pending || !selectedTicker || !date?.from || !date?.to} className="workspace-primary">
              <Sparkles aria-hidden="true" />
              {pending ? "Analyzing…" : result?.error ? "Try again" : "Analyze stock"}
            </Button>
          </div>
        </fetcher.Form>

        {pending && <p role="status" className="workspace-panel">Fetching prices and generating the report…</p>}

        {result?.error && (
          <p role="alert" className="workspace-panel border-destructive/40">{result.error}</p>
        )}

        {prices && (
          <section aria-labelledby="research-prices" className="workspace-panel space-y-4">
            <div>
              <h2 id="research-prices" className="text-xl font-semibold tracking-tight">Price snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">{result.ticker}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {metrics.map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-background p-4">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-lg font-semibold tabular-nums">
                    {value == null ? "Unavailable" : `${result.currency ?? "NGN"} ${value}`}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {result?.content && (
          <section aria-labelledby="research-report" className="workspace-panel">
            <h2 id="research-report" className="mb-4 text-xl font-semibold tracking-tight">AI analysis</h2>
            <ReportContent report={result.content} />
          </section>
        )}

        {!pending && !result && (
          <section className="workspace-empty">
            <ChartCandlestick className="size-6 text-indigo-700 dark:text-indigo-400" aria-hidden="true" />
            <h2 className="mt-1 font-semibold">Start with a stock</h2>
            <p className="text-sm text-muted-foreground">Your price snapshot and AI analysis will appear here.</p>
          </section>
        )}
      </main>
    </div>
  );
}
