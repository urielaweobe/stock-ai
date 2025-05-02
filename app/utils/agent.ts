import { Mistral } from "@mistralai/mistralai";
import type { FinancialData } from "./interface";

const mistralClient = new Mistral({
  apiKey: import.meta.env.VITE_MISTRAL_API,
});

export const chat = async ({ data, code, ticker, currency, startDate, endDate }: FinancialData) =>
  await mistralClient.chat.complete({
    model: "open-mistral-7b",
    messages: [
      {
        role: "system",
        content:
          `You are a trading guru. Given data on share prices from ${startDate} to ${endDate}, write a report of no more than 150 words describing the stocks performance and recommending whether to buy, hold or sell.`,
      },
      {
        role: "user",
        content: `data: ${data}, ticker code: ${code}, ticker: ${ticker}, currency: ${currency}`,
      },
    ],
  });
