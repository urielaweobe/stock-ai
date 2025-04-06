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
