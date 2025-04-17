import type { Route } from './+types/home';
import { fetchStockData, fetchTickerList } from '~/api/ticker';
import { useEffect, useState } from 'react';
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
import { useFetcher, type ActionFunctionArgs } from 'react-router';
import { chat } from '~/utils/agent';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Stock AI' },
    {
      name: 'description',
      content: 'Learn about the perfomance of the stock you want to buy next!',
    },
  ];
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const ticker = formData.get('ticker');

  if (typeof ticker !== 'string') {
    return Response.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  const mistralClient = new Mistral({
    apiKey: process.env.VITE_MISTRAL_API,
  });

  try {
    const response = await fetchStockData(ticker);
    const data = await response.text();

    const report = (await chat(data));

    return Response.json({ report });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to generate report' }, { status: 500 });
  }
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
  const stockData = loaderData as LoaderDataProps;
  const fetcher = useFetcher();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [streamedReport, setStreamedReport] = useState('');

  useEffect(() => {
    if (fetcher.data?.report) {
      const fullText = fetcher.data.report as string;
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
  }, [fetcher.data]);

  return (
    <div className="mx-auto flex w-[450px] flex-col">
      <fetcher.Form method="post">
      <input type="hidden" name="ticker" value={value} />
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
                          setValue(currentValue);
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
      </fetcher.Form>
      <div>
        <div className="mt-6 rounded-md border border-slate-200 p-4">
          {fetcher.state === 'submitting' ? (
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
              onClick={() => {
                fetcher.submit({ ticker: value }, { method: 'post' })
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
