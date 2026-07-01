/**
 * Productivity Module Routes
 *
 * Productivity metrics, employee detail, and process documentation.
 * Gated by the "productivity" module.
 */
import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";

import ProductivityPage from "./pages/ProductivityPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import ProcessPage from "./pages/ProcessPage";
import ProcessFormPage from "./pages/ProcessFormPage";
import PodManagement from "@/pages/PodManagement";

export const productivityRoutes = (
  <Route element={<ModuleRoute module="productivity" />}>
    <Route path="/productivity" element={<ProductivityPage />} />
    <Route path="/productivity/employee/:email" element={<EmployeeDetailPage />} />
    <Route path="/pod/management" element={<PodManagement />} />
    <Route path="/process" element={<ProcessPage />} />
    <Route path="/process/new" element={<ProcessFormPage />} />
    <Route path="/process/:category" element={<ProcessPage />} />
    <Route path="/process/:category/new" element={<ProcessFormPage />} />
    <Route path="/process/:category/:slug" element={<ProcessPage />} />
    <Route path="/process/:category/:slug/edit" element={<ProcessFormPage />} />
  </Route>
);
