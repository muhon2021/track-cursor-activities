import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { TopNav } from "./TopNav";
import { MfaGraceBanner } from "@/components/auth/MfaGraceBanner";

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopNav />
          <div className="border-b border-border">
            <MfaGraceBanner />
          </div>
          <main className="flex-1 min-w-0 overflow-auto p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
