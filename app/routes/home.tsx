import type { Route } from "./+types/home";
import { fetchReport, fetchTickerData } from "~/api/ticker";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Check, ChevronsUpDown, RotateCcw, Send } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { cn } from "~/lib/utils";
import LoadingDots from "./components/LoadingDots";
import {
  useFetcher,
  useRouteLoaderData,
  type ActionFunctionArgs,
} from "react-router";
import type { Ticker } from "~/utils/interface";
import { DatePickerWithRange } from "~/components/ui/date-picker";
import type { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { Skeleton } from "~/components/ui/skeleton";
import { AppHeader } from "~/components/app-header";
import { ReportContent } from "~/components/report-content";
import { useStreamedReport } from "~/hooks/use-streamed-report";
import type { RootLoaderData } from "~/root";

interface HomeActionData {
  content?: string;
  error?: string;
  stockHistoricalData?: Array<{
    open?: string;
    close?: string;
    adjusted_close?: string;
    high?: string;
    low?: string;
  }>;
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
    const stockHistoricalData = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Failed to fetch stock data" },
        { status: response.status }
      );
    }

    const report = await fetchReport({
      data: JSON.stringify(stockHistoricalData),
      code,
      ticker,
      currency,
      startDate: startDate.slice(0, 10),
      endDate: endDate.slice(0, 10),
    });
    const reportPayload = await report.json();

    if (!report.ok) {
      return Response.json(
        {
          error:
            typeof reportPayload?.error === "string"
              ? reportPayload.error
              : "Failed to generate report",
        },
        { status: report.status }
      );
    }

    return { content: reportPayload.content, stockHistoricalData };
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

  const stockHistoricalData = fetcher.data?.stockHistoricalData;
  const lastHistoricalStockEntry =
    stockHistoricalData && stockHistoricalData.length > 0
      ? stockHistoricalData[stockHistoricalData.length - 1]
      : null;

  const { streamedReport, streamFinished } = useStreamedReport({
    content: fetcher.data?.content,
    error: fetcher.data?.error,
    isSubmitting: fetcher.state === "submitting",
  });

  const renderStockValue = (value: string | undefined) => {
    if (fetcher.state !== "idle") {
      return <Skeleton className="h-5 w-[50px]" />;
    }

    return value ?? "N/A";
  };

  return (
    <div className="min-h-dvh w-full overflow-auto">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-col p-6">
        <fetcher.Form method="post">
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
            value={date?.from ? date.from.toISOString() : ""}
          />
          <input
            type="hidden"
            name="endDate"
            value={date?.to ? date.to.toISOString() : ""}
          />
          <div className="md:flex items-center justify-center gap-2 w-full">
            <div className="mb-4 md:mb-0">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger className="cursor-pointer w-full" asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="md:w-[300px] justify-between"
                    name="ticker"
                    value={selectedTicker?.Name}
                  >
                    {selectedTicker?.Name ? (
                      <span className="block max-w-[200px] truncate">
                        {stockList.find(
                          (ticker: Ticker) => ticker.Name === selectedTicker?.Name
                        )?.Name || ""}
                      </span>
                    ) : (
                      "Select a stock"
                    )}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search stock..."
                      className="h-9 text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No stock found.</CommandEmpty>
                      <CommandGroup>
                        {stockList.map((ticker: Ticker) => (
                          <CommandItem
                            className="cursor-pointer"
                            key={ticker.Code}
                            value={ticker.Name}
                            onSelect={() => {
                              setSelectedTicker(ticker);
                              setOpen(false);
                            }}
                          >
                            {ticker.Name}
                            <Check
                              className={cn(
                                "ml-auto",
                                selectedTicker?.Name === ticker.Name
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

            <div className="flex justify-between items-center md:space-x-2">
              <DatePickerWithRange
                date={date}
                setDate={setDate}
                className="cursor-pointer"
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                disabled={!selectedTicker}
                className="cursor-pointer disabled:cursor-not-allowed md:w-[50px]"
              >
                <Send />
              </Button>
            </div>
          </div>
        </fetcher.Form>

        <div className="mt-3">
          <div className="mt-2 flex justify-between [text-align:-webkit-center] md:flex-row">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Open (₦) <br />-
              <br />
              {renderStockValue(lastHistoricalStockEntry?.open)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Close (₦) <br />-
              <br />
              {renderStockValue(lastHistoricalStockEntry?.close)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Adjusted Close (₦) <br />-
              <br />
              {renderStockValue(lastHistoricalStockEntry?.adjusted_close)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              High (₦) <br />-
              <br />
              {renderStockValue(lastHistoricalStockEntry?.high)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Low (₦) <br />-
              <br />
              {renderStockValue(lastHistoricalStockEntry?.low)}
            </p>
          </div>

          <div className="mt-6 rounded-md border border-slate-200 p-4 shadow dark:border-slate-800">
            {fetcher.state === "submitting" ? (
              <LoadingDots />
            ) : (
              <ReportContent report={streamedReport} />
            )}
          </div>

          {streamFinished && (
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer dark:text-gray-200"
                onClick={() => {
                  fetcher.submit(
                    {
                      ticker: selectedTicker?.Name || "",
                      code: selectedTicker?.Code || "",
                      exchange: selectedTicker?.Exchange || "",
                      currency: selectedTicker?.Currency || "",
                      startDate: date?.from?.toISOString() || "",
                      endDate: date?.to?.toISOString() || "",
                    },
                    { method: "post" }
                  );
                }}
              >
                <RotateCcw />
                Retry
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
