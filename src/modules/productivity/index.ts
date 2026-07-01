export { productivityRoutes } from "./routes";
export {
  useProductivityRecords,
  useProductivitySummary,
  useDepartments,
  useAvailableWeeks,
  usePodProductivity,
  useAIProductivityInsights,
} from "./hooks/useProductivity";
export type { ProductivityRecord, ProductivityFilters, ProductivitySummary } from "./types";
