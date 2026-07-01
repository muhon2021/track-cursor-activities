import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Download, Trash2, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMemoryAdminSearch, useMemoryAdminList, useMemoryAdminActions } from "@/hooks/useKbMemoryAdmin";
import { formatDateTime } from "@/lib/utils";

export default function MemoryAdministration() {
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const search = useMemoryAdminSearch(email || undefined, department || undefined);
  const memories = useMemoryAdminList(selectedUserId);
  const actions = useMemoryAdminActions();

  const handleExport = () => {
    if (!selectedUserId) return;
    actions.mutate({ action: "export", user_id: selectedUserId }, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `memories-${selectedUserId}.json`;
        a.click();
      },
    });
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          Memory Administration
        </h1>
        <p className="text-muted-foreground mt-1">GDPR-compliant user memory management</p>
      </div>

      <Card>
        <CardHeader><CardTitle>User Search</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
          </div>
        </CardContent>
      </Card>

      {search.isFetching && <Loader2 className="h-6 w-6 animate-spin mx-auto" />}

      {search.data && search.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Memories</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {search.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.department ?? "—"}</TableCell>
                    <TableCell>{u.memory_count}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedUserId(u.id)}>
                        <Search className="h-3 w-3 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedUserId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Memory Viewer</CardTitle>
              <CardDescription>User ID: {selectedUserId}</CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={actions.isPending}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </CardHeader>
          <CardContent>
            {memories.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(memories.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="max-w-xs truncate">{m.content}</TableCell>
                      <TableCell><Badge variant="outline">{m.memory_type}</Badge></TableCell>
                      <TableCell>{m.source ?? "—"}</TableCell>
                      <TableCell>{m.confidence_score?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(m.created_at)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(m.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete memory?</AlertDialogTitle>
            <AlertDialogDescription>This performs a soft delete. The action is audit-logged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteId && selectedUserId) {
                actions.mutate({ action: "delete", user_id: selectedUserId, memory_id: deleteId });
                setDeleteId(null);
                memories.refetch();
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
