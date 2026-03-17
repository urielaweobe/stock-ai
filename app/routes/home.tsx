import type { Route } from "./+types/home";
import { fetchReport, fetchStockList, fetchTickerData } from "~/api/ticker";
import { Fragment, useEffect, useState, type ReactNode } from "react";
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
  useLoaderData,
  type ActionFunctionArgs,
} from "react-router";
import type { Ticker } from "~/utils/interface";
import { DatePickerWithRange } from "~/components/ui/date-picker";
import type { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { ThemeSwitcher } from "~/components/theme-toggle";
import { getStoredTheme, type Theme } from "~/utils/theme";
import { Skeleton } from "~/components/ui/skeleton";

type ReportListType = "ul" | "ol";

const reportHeadingStyles: Record<number, string> = {
  1: "text-2xl font-semibold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold uppercase tracking-wide",
};

const renderHeading = (level: number, text: string, key: string) => {
  const className = reportHeadingStyles[level];
  const content = renderInlineMarkdown(text);

  switch (level) {
    case 1:
      return (
        <h1 key={key} className={className}>
          {content}
        </h1>
      );
    case 2:
      return (
        <h2 key={key} className={className}>
          {content}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} className={className}>
          {content}
        </h3>
      );
    case 4:
      return (
        <h4 key={key} className={className}>
          {content}
        </h4>
      );
    case 5:
      return (
        <h5 key={key} className={className}>
          {content}
        </h5>
      );
    default:
      return (
        <h6 key={key} className={className}>
          {content}
        </h6>
      );
  }
};

const renderInlineMarkdown = (text: string) => {
  const segments: ReactNode[] = [];
  let buffer = "";
  let isBold = false;
  let isItalic = false;

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }

    let content: ReactNode = buffer;

    if (isItalic) {
      content = <em>{content}</em>;
    }

    if (isBold) {
      content = <strong className="font-semibold">{content}</strong>;
    }

    segments.push(<Fragment key={`segment-${segments.length}`}>{content}</Fragment>);
    buffer = "";
  };

  for (let index = 0; index < text.length; index++) {
    const currentCharacter = text[index];
    const nextCharacter = text[index + 1];

    if (currentCharacter === "*" && nextCharacter === "*") {
      flushBuffer();
      isBold = !isBold;
      index++;
      continue;
    }

    if (currentCharacter === "*") {
      flushBuffer();
      isItalic = !isItalic;
      continue;
    }

    buffer += currentCharacter;
  }

  flushBuffer();

  return segments;
};

const renderReportContent = (report: string) => {
  const lines = report.replace(/\r\n/g, "\n").split("\n");
  const content: ReactNode[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];
  let currentListType: ReportListType | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const paragraph = paragraphLines.join(" ");
    content.push(
      <p key={`paragraph-${content.length}`} className="leading-7">
        {renderInlineMarkdown(paragraph)}
      </p>
    );
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!currentListType || listItems.length === 0) {
      return;
    }

    const ListTag = currentListType;
    content.push(
      <ListTag
        key={`list-${content.length}`}
        className={`ml-6 space-y-2 ${currentListType === "ul" ? "list-disc" : "list-decimal"}`}
      >
        {listItems.map((item, index) => (
          <li key={`${currentListType}-item-${index}`} className="leading-7">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );

    currentListType = null;
    listItems.length = 0;
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      flushParagraph();
      flushList();

      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      content.push(renderHeading(level, headingText, `heading-${content.length}`));
      return;
    }

    const unorderedListMatch = trimmedLine.match(/^[-*]\s+(.*)$/);

    if (unorderedListMatch) {
      flushParagraph();

      if (currentListType && currentListType !== "ul") {
        flushList();
      }

      currentListType = "ul";
      listItems.push(unorderedListMatch[1]);
      return;
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);

    if (orderedListMatch) {
      flushParagraph();

      if (currentListType && currentListType !== "ol") {
        flushList();
      }

      currentListType = "ol";
      listItems.push(orderedListMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  return content;
};

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

export async function loader() {
  try {
    const response = await fetchStockList();
    const stockList = await response.json();

    if (!response.ok) {
      throw new Error("Failed to fetch stock list");
    }

    return { stockList };
  } catch (error) {
    console.error("Failed to fetch stock list:", error);
    return { stockList: [] };
  }
};

export default function Home() {
  const fetcher = useFetcher();
  const { stockList } = useLoaderData();

  const [open, setOpen] = useState(false);
  const [streamedReport, setStreamedReport] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<Ticker | undefined>();
  const [streamFinished, setStreamFinished] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 3),
    to: new Date(),
  });
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const stockHistoricalData = fetcher.data?.stockHistoricalData;

  const lastHistoricalStockEntry =
    stockHistoricalData?.length > 0
      ? stockHistoricalData[stockHistoricalData?.length - 1]
      : null;

  const formattedReport = renderReportContent(streamedReport);

  useEffect(() => {
    if (fetcher.state === "submitting") {
      setStreamedReport("");
      setStreamFinished(false);
    }
  }, [fetcher.state]);

  useEffect(() => {
    if (fetcher.data?.content) {
      const fullText = fetcher.data.content as string;
      let i = 0;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const streamText = () => {
        if (i <= fullText.length) {
          setStreamedReport(fullText.slice(0, i));
          if (i === fullText.length) {
            setStreamFinished(true);
          }
          i++;
          timeoutId = setTimeout(streamText, 10);
        }
      };

      streamText();

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    } else if (fetcher.data?.error) {
      setStreamedReport(fetcher.data.error);
      setStreamFinished(true);
    }
  }, [fetcher.data]);

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
                        {stockList.find(
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
                        {stockList.map((ticker: any, index: any) => (
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
              <div className="space-y-3 text-base break-words dark:text-gray-200">
                {formattedReport}
              </div>
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
