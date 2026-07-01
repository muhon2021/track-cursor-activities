import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopNav } from "./TopNav";
import { useOnboardingRedirect } from "@/hooks/useOnboarding";
import { MfaGraceBanner } from "@/components/auth/MfaGraceBanner";

export function DashboardLayout() {
  const { needsOnboarding, loading } = useOnboardingRedirect();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && needsOnboarding && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, needsOnboarding, navigate, location.pathname]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopNav />
          <MfaGraceBanner />
          <main className="flex-1 min-w-0 overflow-auto p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
