import type { FinancialData } from "./../utils/interface";
// Note to self: The EOD API is not free. You need to sign up for an account and get an API key.
// The free tier allows you to make 20 requests per day. You can upgrade to a paid plan for more requests.
// The API key is stored in the .env file as VITE_EOD_API. You can use this key to make requests to the API.
// I previously used the POLYGON API, but it does not have Nigerian stocks listed on it.

// The endpoint I use for fetching the list of tickers/stocks on EOD is:
// https://eodhd.com/api/exchange-symbol-list/XNSA?api_token={import.meta.env.VITE_EOD_API}&fmt=json

interface FetchTickerData {
  code: string;
  exchange: string;
  startDate: string;
  endDate: string;
}

export const fetchTickerData = async ({
  code,
  exchange,
  startDate,
  endDate,
}: FetchTickerData) =>
  await fetch(
    `https://eodhd-api-worker.urielaweobe.workers.dev/?code=${code}&exchange=${exchange}&startDate=${startDate}&endDate=${endDate}`,
    {
      method: "GET",
    }
  );

const url = "https://stock-ai-worker.urielaweobe.workers.dev";

export const fetchReport = async ({
  data,
  code,
  ticker,
  currency,
  startDate,
  endDate,
}: FinancialData) =>
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data,
      code,
      ticker,
      currency,
      startDate,
      endDate,
    }),
  });
