import { Mistral } from "@mistralai/mistralai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only process POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: `${request.method} method not allowed.`}), { status: 405, headers: corsHeaders })
    }

    const mistralClient = new Mistral({
      apiKey: env.MISTRAL_API_KEY,
      serverURL:
        "https://gateway.ai.cloudflare.com/v1/4d87a40ea2da240ef0abdb578daa9e4d/stock-ai-recommendation/mistral",
    });

    try {
      const body = await request.json();
      const { startDate, endDate, data, code, ticker, currency } = body;

      if (!startDate || !endDate || !data || !code || !ticker || !currency) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const chatCompletion = await mistralClient.chat.complete({
        model: "open-mistral-7b",
        messages: [
          {
            role: "system",
            content: `You are a trading guru. Given data on share prices from ${startDate} to ${endDate}, write a report of no more than 150 words describing the stock's performance and recommending whether to buy, hold or sell.`,
          },
          {
            role: "user",
            content: `data: ${data}, ticker code: ${code}, ticker: ${ticker}, currency: ${currency}`,
          },
        ],
      });

      const response = chatCompletion.choices[0].message.content;

      return new Response(JSON.stringify({ content: response }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message || "Unknown error" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  },
};
