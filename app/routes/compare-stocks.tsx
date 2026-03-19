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
import { Check, ChevronsUpDown, Send, X } from "lucide-react";
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
import { useStreamedReport } from "~/hooks/use-streamed-report";
import { cn } from "~/lib/utils";
import type { Ticker } from "~/utils/interface";
import type { RootLoaderData } from "~/root";

interface CompareStocksActionData {
  content?: string;
  error?: string;
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

  if (selectedTickers.length < 2) {
    return Response.json(
      { error: "Please select at least two stocks to compare." },
      { status: 400 }
    );
  }

  const normalizedStartDate = startDate.slice(0, 10);
  const normalizedEndDate = endDate.slice(0, 10);

  try {
    const stockHistoricalData = await Promise.all(
      selectedTickers.map(async (selectedTicker) => {
        const response = await fetchTickerData({
          code: selectedTicker.Code,
          exchange: selectedTicker.Exchange,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${selectedTicker.Name}.`);
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
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      comparisonTickers: selectedTickers,
    });
    const reportPayload = await report.json();

    if (!report.ok) {
      return Response.json(
        {
          error:
            typeof reportPayload?.error === "string"
              ? reportPayload.error
              : "Failed to generate comparison report.",
        },
        { status: report.status }
      );
    }

    return {
      content: reportPayload.content,
      selectedTickers,
      stockHistoricalData,
    };
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

  const { streamedReport, streamFinished } = useStreamedReport({
    content: fetcher.data?.content,
    error: fetcher.data?.error,
    isSubmitting: fetcher.state === "submitting",
  });

  const toggleTicker = (ticker: Ticker) => {
    setSelectedTickers((currentTickers) => {
      const alreadySelected = currentTickers.some(
        (selectedTicker) => selectedTicker.Code === ticker.Code
      );

      if (alreadySelected) {
        return currentTickers.filter(
          (selectedTicker) => selectedTicker.Code !== ticker.Code
        );
      }

      return [...currentTickers, ticker];
    });
  };

  return (
    <div className="min-h-dvh w-full overflow-auto">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Compare stocks with AI
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Select at least two stocks, choose a date range, and generate a
            structured comparison covering performance, risk, and overall
            investment outlook.
          </p>
        </section>

        <fetcher.Form method="post" className="space-y-4 rounded-xl border p-5 shadow-sm">
          <input
            type="hidden"
            name="selectedTickers"
            value={JSON.stringify(selectedTickers)}
          />
          <input
            type="hidden"
            name="startDate"
            value={date?.from ? date.from.toISOString() : ""}
          />
          <input
            type="hidden"
            name="endDate"
            value={date?.to ? date.to.toISOString() : ""}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Stocks</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
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
                      : "Select stocks to compare"}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search stock..."
                    className="h-9 text-sm"
                  />
                  <CommandList>
                    <CommandEmpty>No stock found.</CommandEmpty>
                    <CommandGroup>
                      {stockList.map((ticker: Ticker) => {
                        const isSelected = selectedTickers.some(
                          (selectedTicker) => selectedTicker.Code === ticker.Code
                        );

                        return (
                          <CommandItem
                            key={ticker.Code}
                            className="cursor-pointer"
                            value={`${ticker.Name} ${ticker.Code}`}
                            onSelect={() => {
                              toggleTicker(ticker);
                              setOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{ticker.Name}</span>
                              <span className="text-xs text-slate-500">
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
                  key={ticker.Code}
                  type="button"
                  onClick={() => toggleTicker(ticker)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>
                    {ticker.Name} ({ticker.Code})
                  </span>
                  <X className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date range</label>
              <DatePickerWithRange date={date} setDate={setDate} />
            </div>

            <Button
              type="submit"
              disabled={
                selectedTickers.length < 2 || !date?.from || !date?.to
              }
              className="cursor-pointer"
            >
              <Send className="mr-2 h-4 w-4" />
              Compare stocks
            </Button>
          </div>
        </fetcher.Form>

        {(fetcher.state === "submitting" || streamedReport) && (
          <section className="rounded-xl border border-slate-200 p-5 shadow-sm dark:border-slate-800">
            {fetcher.state === "submitting" ? (
              <LoadingDots />
            ) : (
              <ReportContent report={streamedReport} />
            )}
          </section>
        )}

        {streamFinished && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tip: adjust the date range or swap one of the stocks to generate a
            different angle on the comparison.
          </p>
        )}
      </main>
    </div>
  );
}
