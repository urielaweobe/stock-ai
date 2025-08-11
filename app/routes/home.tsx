import type { Route } from "./+types/home";
import { fetchReport, fetchTickerData } from "~/api/ticker";
import { useEffect, useState } from "react";
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
import { useFetcher, type ActionFunctionArgs } from "react-router";
import { chat } from "~/utils/agent";
import stockData from "~/utils/stock-data.json";
import type { Ticker } from "~/utils/interface";
import { DatePickerWithRange } from "~/components/ui/date-picker";
import type { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { ThemeSwitcher } from "~/components/theme-toggle";
import { getStoredTheme, type Theme } from "~/utils/theme";
import { Skeleton } from "~/components/ui/skeleton";

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
  const code = formData.get("code") as string;
  const exchange = formData.get("exchange") as string;
  const ticker = formData.get("ticker") as string;
  const currency = formData.get("currency") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (typeof code !== "string") {
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
      const errorMessage = await response.text();
      return Response.json(
        { error: errorMessage || "Failed to fetch stock data" },
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

    const { content } = await report.json();

    if (!report.ok) {
      const errorMessage = await report.text();
      return Response.json(
        { error: errorMessage || "Failed to generate report" },
        { status: report.status }
      );
    }

    return { content, stockHistoricalData };
  } catch (error) {
    return Response.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

export default function Home() {
  const fetcher = useFetcher();

  const [open, setOpen] = useState(false);
  const [streamedReport, setStreamedReport] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | undefined>();
  const [streamFinished, setStreamFinished] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 3),
    to: new Date(),
  });

  const stockHistoricalData = fetcher.data?.stockHistoricalData;

  const lastHistoricalStockEntry =
    stockHistoricalData?.length > 0
      ? stockHistoricalData[stockHistoricalData?.length - 1]
      : null;

  useEffect(() => {
    if (fetcher.data?.content) {
      const fullText = fetcher.data.content as string;
      let i = 0;
      const streamText = () => {
        if (i <= fullText.length) {
          setStreamedReport(fullText.slice(0, i));
          i++;
          if (i === fullText.length) {
            setStreamFinished(true);
          }
          setTimeout(streamText, 10);
        }
      };
      streamText();
    } else if (fetcher.data?.error) {
      setStreamedReport(fetcher.data.error);
      setStreamFinished(true);
    }
  }, [fetcher.data]);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const renderStockValue = (value: string | undefined) => {
    if (fetcher.state !== "idle") {
      return <Skeleton className="h-5 w-[50px]" />;
    }
    return value ?? "N/A";
  };

  return (
    <div className="h-dvh w-full overflow-auto">
      <header className="flex justify-end py-3 pr-6 sticky top-0 z-50 bg-white dark:bg-gray-900 border-b">
        <ThemeSwitcher theme={theme} setTheme={setTheme} />
      </header>
      <main className="mx-auto flex md:w-[700px] flex-col p-6">
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
                        {stockData.find(
                          (ticker: any) => ticker.Name === selectedTicker?.Name
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
                        {stockData.map((ticker: any, index: any) => (
                          <CommandItem
                            className="cursor-pointer"
                            key={index}
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
                className=" cursor-pointer"
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
          <div className="flex justify-between mt-2 [text-align:-webkit-center] md:flex-row">
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

          <div className="mt-6 rounded-md border border-slate-200 p-4 shadow">
            {fetcher.state === "submitting" ? (
              <LoadingDots />
            ) : (
              <p className="text-base whitespace-pre-wrap dark:text-gray-200">
                {streamedReport}
              </p>
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
