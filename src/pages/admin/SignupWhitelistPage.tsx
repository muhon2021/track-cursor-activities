import { useState } from "react";
import {
  useSignupDomainWhitelist,
  useAddSignupDomain,
  useToggleSignupDomain,
  useRemoveSignupDomain,
} from "@/hooks/useSignupWhitelist";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Globe, Trash2 } from "lucide-react";

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default function SignupWhitelistPage() {
  const { data: domains, isLoading } = useSignupDomainWhitelist();
  const addDomain = useAddSignupDomain();
  const toggleDomain = useToggleSignupDomain();
  const removeDomain = useRemoveSignupDomain();

  const [newDomain, setNewDomain] = useState("");

  const handleAdd = () => {
    if (!newDomain.trim()) return;
    addDomain.mutate(newDomain.trim().toLowerCase(), {
      onSuccess: () => setNewDomain(""),
    });
  };

  const activeCount = (domains ?? []).filter((d) => d.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Self-Signup Domain Whitelist</h1>
        <p className="text-muted-foreground">
          Restrict open self-signup to approved email domains. Invited users always bypass this
          check. If no domains are listed here, self-signup is open to any email address.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>Allowed domains</CardTitle>
          </div>
          <CardDescription>
            {activeCount > 0
              ? `${activeCount} domain(s) actively enforced.`
              : "No active domains — self-signup is currently open to any email address."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={addDomain.isPending || !newDomain.trim()}>
              {addDomain.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(domains ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No domains configured yet.
                    </TableCell>
                  </TableRow>
                )}
                {(domains ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.domain}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) =>
                            toggleDomain.mutate({ id: row.id, is_active: checked })
                          }
                          disabled={toggleDomain.isPending}
                        />
                        {row.is_active ? (
                          <Badge variant="default" className="bg-success">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDomain.mutate(row.id)}
                        disabled={removeDomain.isPending}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
