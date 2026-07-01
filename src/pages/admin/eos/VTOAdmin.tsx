/**
 * VTO Administration — Compare, export, and audit Vision/Traction Organizer records across pods.
 *
 * - Summary stats: Total VTOs, Average completion, Pods linked, Versions tracked
 * - Pod-level VTOs table (Assign to pod, Export)
 * - Version comparison (source/target)
 * - Audit history
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Sparkles, ShieldCheck, ClipboardList, History, Download, ChevronDown, GitCompareArrows } from "lucide-react";
import { useEOSPods } from "@/modules/eos/hooks/useEOSPods";
import { useVTO } from "@/modules/eos/hooks/useVTO";
import { toast } from "sonner";

export default function VTOAdmin() {
  const { data: pods = [], isLoading: podsLoading } = useEOSPods();
  const { data: sections = [], isLoading: sectionsLoading } = useVTO();
  const [assignPodOpen, setAssignPodOpen] = useState(false);
  const [sourceVersion, setSourceVersion] = useState<string>("");
  const [targetVersion, setTargetVersion] = useState<string>("");

  const isLoading = podsLoading || sectionsLoading;

  const totalVTOs = 0;
  const averageCompletion = 0;
  const podsLinked = 0;
  const versionsTracked = 0;

  const vtoRecords: { pod: string; completion: number; updated: string; status: string }[] = [];

  const versionOptions = (sections || []).map((s) => ({
    value: s.id,
    label: `${s.title || s.section} (v${s.sort_order})`,
  }));

  const handleExport = () => {
    toast.info("Export will be available when pod-level VTO records exist.");
  };

  const handleAssignToPod = (_podId: string) => {
    setAssignPodOpen(false);
    toast.info("Assign to pod will be available via admin API.");
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">VTO Administration</h1>
        <p className="text-muted-foreground mt-1">
          Compare, export, and audit Vision/Traction Organizer records across pods.
        </p>
      </div>

      {/* Summary statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total VTOs</p>
                <p className="text-2xl font-bold">{totalVTOs}</p>
              </div>
              <Sparkles className="h-9 w-9 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average completion</p>
                <p className="text-2xl font-bold">{averageCompletion}%</p>
              </div>
              <ShieldCheck className="h-9 w-9 text-success opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pods linked</p>
                <p className="text-2xl font-bold">{podsLinked}</p>
              </div>
              <ClipboardList className="h-9 w-9 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Versions tracked</p>
                <p className="text-2xl font-bold">{versionsTracked}</p>
              </div>
              <History className="h-9 w-9 text-amber-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pod-level VTOs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pod-level VTOs</CardTitle>
              <CardDescription>Securely managed via admin APIs.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu open={assignPodOpen} onOpenChange={setAssignPodOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Assign to pod
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {pods.length === 0 ? (
                    <DropdownMenuItem disabled>No pods</DropdownMenuItem>
                  ) : (
                    pods.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => handleAssignToPod(p.id)}>
                        {p.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pod</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vtoRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No VTO records found. Create or import VTOs via the admin API.
                </TableCell>
              </TableRow>
            ) : (
              vtoRecords.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.pod}</TableCell>
                  <TableCell>{row.completion}%</TableCell>
                  <TableCell>{row.updated}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Actions</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Version comparison + Audit history */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" />
              Version comparison
            </CardTitle>
            <CardDescription>Compare changes between VTO revisions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Source version</label>
                <Select value={sourceVersion} onValueChange={setSourceVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    {versionOptions.length === 0 && (
                      <SelectItem value="_none" disabled>No versions</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target version</label>
                <Select value={targetVersion} onValueChange={setTargetVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    {versionOptions.length === 0 && (
                      <SelectItem value="_none" disabled>No versions</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Select two versions to view differences.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit history
            </CardTitle>
            <CardDescription>Track admin operations executed through secure APIs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-sm">
              No audit entries for this VTO yet.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
