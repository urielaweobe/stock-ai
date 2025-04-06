import { dates } from "~/utils/dates";


export const fetchTickerList = async () =>
  await fetch(
    `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&order=asc&limit=1000&sort=locale&locale=global&apiKey=${
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
    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${
      dates.startDate
    }/${dates.endDate}?apiKey=${import.meta.env.VITE_POLYGON_API}`,
    {
      method: "GET",
    }
  );
