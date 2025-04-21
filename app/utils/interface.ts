export interface LoaderDataProps {
  count: number;
  next_url: string;
  request_id: string;
  results: [
    {
      ticker: string;
      name: string;
    }
  ];
  status: string;
}

export interface Ticker {
  Name: string;
  Code: string;
  Exchange: string;
  Currency: string;
}

export interface FinancialData {
  data: string;
  code: string;
  ticker: string;
  currency: string;
}
