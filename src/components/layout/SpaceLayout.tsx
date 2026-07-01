import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SpaceProvider } from "@/contexts/SpaceContext";
import { SpaceSidebar } from "./SpaceSidebar";
import { TopNav } from "./TopNav";
import { useOnboardingRedirect } from "@/hooks/useOnboarding";
import { useSpace } from "@/contexts/SpaceContext";
import { Loader2 } from "lucide-react";

function SpaceLayoutInner() {
  const { needsOnboarding, loading } = useOnboardingRedirect();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading } = useSpace();

  useEffect(() => {
    if (!loading && needsOnboarding && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, needsOnboarding, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <SpaceSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav />
        <main className="flex-1 min-w-0 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SpaceLayout() {
  return (
    <SidebarProvider>
      <SpaceProvider>
        <SpaceLayoutInner />
      </SpaceProvider>
    </SidebarProvider>
  );
}
