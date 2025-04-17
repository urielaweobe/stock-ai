import { Mistral } from "@mistralai/mistralai";

const mistralClient = new Mistral({
    apiKey: process.env.VITE_MISTRAL_API,
  });

export const chat = async (data: string) => await mistralClient.chat.complete({
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