import { Mistral } from "@mistralai/mistralai";

const mistralClient = new Mistral({
  apiKey: import.meta.env.VITE_MISTRAL_API,
});

interface X {
  data: string;
  code: string;
  ticker: string;
  currency: string;
}

export const chat = async ({ data, code, ticker, currency }: X) =>
  await mistralClient.chat.complete({
    model: "open-mistral-7b",
    messages: [
      {
        role: "system",
        content:
          "You are a trading guru. Given data on share prices over the past 3 days, write a report of no more than 150 words describing the stocks performance and recommending whether to buy, hold or sell.",
      },
      {
        role: "user",
        content: `data: ${data}, ticker: ${code}, name: ${ticker}, currency: ${currency}`,
      },
    ],
  });
