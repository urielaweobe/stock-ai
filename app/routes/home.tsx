import type { Route } from './+types/home';
import { fetchStockData, fetchTickerList } from '~/api/ticker';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { Check, ChevronsUpDown, RotateCcw, Send } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import { cn } from '~/lib/utils';
import { Mistral } from '@mistralai/mistralai';
import LoadingDots from './components/LoadingDots';
import type { LoaderDataProps } from '~/utils/interface';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Stock AI' },
    {
      name: 'description',
      content: 'Learn about the perfomance of the stock you want to buy next!',
    },
  ];
}

export const loader = async () => {
  const response = await fetchTickerList();
  if (!response.ok) {
    throw new Response('Failed to fetch ticker list', {
      status: response.status,
    });
  }
  const data = await response.json();
  return Response.json(data);
};

export default function Home({ loaderData }: Route.ComponentProps) {
  const mistralClient = new Mistral({
    apiKey: import.meta.env.VITE_MISTRAL_API,
  });
  const stockData = loaderData as LoaderDataProps;

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [streamedReport, setStreamedReport] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchReport(data: string) {
    setLoading(true);
    setStreamedReport('');

    const response = await mistralClient.chat.complete({
      model: 'open-mistral-7b',
      messages: [
        {
          role: 'system',
          content:
            'You are a trading guru. Given data on share prices over the past 3 days, write a report of no more than 150 words describing the stocks performance and recommending whether to buy, hold or sell.',
        },
        {
          role: 'user',
          content: data,
        },
      ],
    });

    setLoading(false);

    if (response.choices && response.choices[0].message.content) {
      const fullText = response.choices[0].message.content as string;

      let i = 0;
      const streamText = () => {
        if (i <= fullText.length) {
          setStreamedReport(fullText.slice(0, i));
          i++;
          setTimeout(streamText, 10);
        }
      };

      streamText();
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetchStockData(value);
      const data = await response.text();
      fetchReport(data);

      return data;
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
  };

  return (
    <div className="mx-auto flex w-[450px] flex-col">
      <form onSubmit={handleSubmit}>
        <div className="mt-40 flex h-full items-center justify-center space-x-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[400px] justify-between"
                name="ticker"
                value={value}
              >
                {value ? (
                  <span className="block max-w-[300px] truncate">
                    {stockData.results.find(
                      (ticker: any) => ticker.ticker === value,
                    )?.name || ''}
                  </span>
                ) : (
                  'Select stock...'
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
                    {stockData.results.map((ticker: any, index: any) => (
                      <CommandItem
                        key={index}
                        value={ticker.ticker}
                        onSelect={(currentValue) => {
                          setValue(currentValue === value ? '' : currentValue);
                          setOpen(false);
                        }}
                      >
                        {ticker.name}
                        <Check
                          className={cn(
                            'ml-auto',
                            value === ticker.ticker
                              ? 'opacity-100'
                              : 'opacity-0',
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
      </form>
      <div>
        <div className="mt-6 rounded-md border border-slate-200 p-4">
          {loading ? (
            <LoadingDots />
          ) : (
            <p className="text-base whitespace-pre-wrap dark:text-gray-200">
              {streamedReport}
            </p>
          )}
        </div>
        {!!streamedReport && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer dark:text-gray-200"
              onClick={handleSubmit}
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
