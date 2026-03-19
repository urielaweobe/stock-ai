import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("compare-stocks", "routes/compare-stocks.tsx"),
] satisfies RouteConfig;
