/**
 * Employee Detail Page - Individual productivity view
 *
 * Route: /productivity/employee/:email (email is URL-encoded).
 * Employee is identified by email; productivity data should use unique emails per person.
 */

import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Mail, Building2, MapPin, Calendar, TrendingUp, Clock, Loader2, BarChart3 } from "lucide-react";
import { useEmployeeByEmail, useEmployeeProductivity } from "../hooks/useEmployees";

export default function EmployeeDetailPage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const decodedEmail = decodeURIComponent(email || "");

  const { data: employee, isLoading: loadingProfile } = useEmployeeByEmail(decodedEmail);
  const { data: records = [], isLoading: loadingRecords } = useEmployeeProductivity(decodedEmail);

  const isLoading = loadingProfile || loadingRecords;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const avgUtil = records.length ? Math.round(records.reduce((s, r) => s + r.utilization_pct, 0) / records.length) : 0;
  const avgEff = records.length ? Math.round(records.reduce((s, r) => s + r.efficiency_score, 0) / records.length) : 0;
  const totalTasks = records.reduce((s, r) => s + r.tasks_completed, 0);
  const totalHours = records.reduce((s, r) => s + r.total_hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/productivity")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{employee?.full_name || decodedEmail}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {employee?.title && <span className="flex items-center gap-1"><User className="h-3 w-3" />{employee.title}</span>}
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{decodedEmail}</span>
            {employee?.department && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{employee.department.name}</span>}
            {employee?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{employee.location}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Avg Utilization</p></div>
            <p className="text-2xl font-bold mt-1">{avgUtil}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Avg Efficiency</p></div>
            <p className="text-2xl font-bold mt-1">{avgEff}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Total Hours</p></div>
            <p className="text-2xl font-bold mt-1">{totalHours.toFixed(0)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Tasks Completed</p></div>
            <p className="text-2xl font-bold mt-1">{totalTasks}</p>
          </CardContent>
        </Card>
      </div>

      {employee && (
        <Card>
          <CardHeader><CardTitle className="text-base">Profile Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {employee.hire_date && (
                <div>
                  <p className="text-muted-foreground">Hire Date</p>
                  <p className="font-medium">{new Date(employee.hire_date).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Employment Type</p>
                <p className="font-medium capitalize">{employee.employment_type}</p>
              </div>
              {employee.manager_email && (
                <div>
                  <p className="text-muted-foreground">Manager</p>
                  <p className="font-medium">{employee.manager_email}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={employee.is_active ? "default" : "secondary"}>{employee.is_active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Weekly Productivity History</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No productivity records.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <div className="w-[120px]">
                    <p className="text-sm font-medium">{new Date(r.week_start).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">Week {r.week_number}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground w-[70px]">Utilization</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(r.utilization_pct, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium w-[40px] text-right">{r.utilization_pct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-[70px]">Efficiency</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(r.efficiency_score, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium w-[40px] text-right">{r.efficiency_score}%</span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>{r.total_hours}h</p>
                      <p className="text-xs text-muted-foreground">{r.tasks_completed} tasks</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    r.attendance_status === "present" ? "border-green-500 text-green-600" :
                    r.attendance_status === "leave" ? "border-blue-500 text-blue-600" :
                    "border-yellow-500 text-yellow-600"
                  }>
                    {r.attendance_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
