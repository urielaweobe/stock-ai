import { dates } from "~/utils/dates";

// Note to self: The EOD API is not free. You need to sign up for an account and get an API key.
// The free tier allows you to make 20 requests per day. You can upgrade to a paid plan for more requests.
// The API key is stored in the .env file as VITE_EOD_API. You can use this key to make requests to the API.
// I previously used the POLYGON API, but it does not have Nigerian stocks listed on it.

interface FetchTickerData {
  code: string;
  exchange: string;
  startDate: string;
  endDate: string;
}

export const fetchTickerData = async ({ code, exchange, startDate, endDate }: FetchTickerData) =>
  await fetch(
    `https://eodhd.com/api/eod/${code}.${exchange}?from=${startDate}&to=${endDate}&period=d&api_token=${
      import.meta.env.VITE_EOD_API
    }&fmt=json`,
    {
      method: "GET",
    }
  );
