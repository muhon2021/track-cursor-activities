import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crosshair, AlertCircle, Calendar, CheckSquare, BarChart3, Users } from "lucide-react";
import { EOS_ROUTES } from "@/lib/eos-routes";

const actions = [
  { label: "Create Rock", icon: Crosshair, to: EOS_ROUTES.rocks },
  { label: "Log Issue", icon: AlertCircle, to: EOS_ROUTES.ids },
  { label: "Schedule L10", icon: Calendar, to: "/eos/meetings/schedule" },
  { label: "Add Todo", icon: CheckSquare, to: EOS_ROUTES.todos },
  { label: "Analytics", icon: BarChart3, to: EOS_ROUTES.analytics },
  { label: "People Analyzer", icon: Users, to: EOS_ROUTES.peopleAnalyzer },
];

export function EOSQuickActionsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">EOS Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {actions.map(({ label, icon: Icon, to }) => (
            <Button key={label} variant="outline" size="sm" className="justify-start gap-2 h-auto py-2" asChild>
              <Link to={to}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
