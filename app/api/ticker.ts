import { dates } from "~/utils/dates";

export const fetchTickerList = async () =>
  await fetch(
    `${
      import.meta.env.VITE_POLYGON_BASE_API
    }/v3/reference/tickers?market=stocks&active=true&order=asc&limit=1000&sort=locale&locale=global&apiKey=${
      import.meta.env.VITE_POLYGON_API
    }`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

export const fetchStockData = async (ticker: string) =>
  await fetch(
    `${
      import.meta.env.VITE_POLYGON_BASE_API
    }/v2/aggs/ticker/${ticker}/range/1/day/${dates.startDate}/${
      dates.endDate
    }?apiKey=${import.meta.env.VITE_POLYGON_API}`,
    {
      method: "GET",
    }
  );

interface Ticker {
  code: string;
  exchange: string;
}

export const fetchTickerData = async ({ code, exchange }: Ticker) =>
  await fetch(
    `https://eodhd.com/api/eod/${code}.${exchange}?from=2025-04-01&to=2025-04-17&period=d&api_token=${
      import.meta.env.VITE_EOD_API
    }&fmt=json`,
    {
      method: "GET",
    }
  );
