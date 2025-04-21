import type { Route } from "./+types/home";
import { fetchTickerData } from "~/api/ticker";
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

  if (typeof code !== "string") {
    return Response.json({ error: "Invalid ticker" }, { status: 400 });
  }

  try {
    const response = await fetchTickerData({
      code,
      exchange,
    });
    const data = await response.json();

    const report = await chat({
      data: JSON.stringify(data),
      code,
      ticker,
      currency,
    });

    return Response.json({ report });
  } catch (error) {
    console.error(error);
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

  useEffect(() => {
    if (fetcher.data?.report) {
      const fullText = fetcher.data.report.choices[0].message.content as string;
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
    }
  }, [fetcher.data]);

  return (
    <div className="mx-auto flex w-[450px] flex-col">
      <fetcher.Form method="post">
        <input type="hidden" name="code" value={selectedTicker?.Code} />
        <input type="hidden" name="exchange" value={selectedTicker?.Exchange} />
        <input type="hidden" name="ticker" value={selectedTicker?.Name} />
        <input type="hidden" name="currency" value={selectedTicker?.Currency} />
        <div className="mt-40 flex h-full items-center justify-center space-x-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[400px] justify-between"
                name="ticker"
                value={selectedTicker?.Name}
              >
                {selectedTicker?.Name ? (
                  <span className="block max-w-[300px] truncate">
                    {stockData.find(
                      (ticker: any) => ticker.Name === selectedTicker?.Name
                    )?.Name || ""}
                  </span>
                ) : (
                  "Select stock..."
                )}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Search stock..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No stock found.</CommandEmpty>
                  <CommandGroup>
                    {stockData.map((ticker: any, index: any) => (
                      <CommandItem
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
          <Button type="submit" variant="outline" size="icon">
            <Send />
          </Button>
        </div>
      </fetcher.Form>
      <div>
        <div className="mt-6 rounded-md border border-slate-200 p-4">
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
                  { ticker: selectedTicker?.Name || "" },
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
    </div>
  );
}
