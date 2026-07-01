import { Suspense, lazy } from "react";
import BDDashboard from "@/pages/dashboards/BDDashboard";

const KnowledgeDashboard = lazy(() => import("@/pages/admin/KnowledgeDashboard"));
const Admin = lazy(() => import("@/pages/Admin"));
const OwnerDashboardWithEOS = lazy(
  () => import("@/pages/dashboards/OwnerDashboardWithEOS")
);

function DashboardFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      Loading dashboard…
    </div>
  );
}

export function SalesSpaceDashboard() {
  return <BDDashboard />;
}

export function KnowledgeSpaceDashboard() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <KnowledgeDashboard />
    </Suspense>
  );
}

export function OperationsSpaceDashboard() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Admin />
    </Suspense>
  );
}

export function EosSpaceDashboard() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <OwnerDashboardWithEOS />
    </Suspense>
  );
}
