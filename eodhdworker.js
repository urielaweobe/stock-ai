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

    const url = new URL(request.url);

    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const code = url.searchParams.get("code");
    const exchange = url.searchParams.get("exchange");

    if (!startDate || !endDate || !code || !exchange) {
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

    const eodhdUrl = `https://eodhd.com/api/eod/${code}.${exchange}?from=${startDate}&to=${endDate}&period=d&api_token=${
      env.VITE_EOD_API
    }&fmt=json`;

    try {
      const eodhdResponse = await fetch(eodhdUrl);

      if (!eodhdResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch stock data" }),
          { status: eodhdResponse.status, headers: corsHeaders }
        );
      }

      const stockData = await eodhdResponse.json();

      return new Response(JSON.stringify(stockData), {
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
