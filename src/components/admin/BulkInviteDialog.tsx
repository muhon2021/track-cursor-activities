/**
 * BulkInviteDialog - paste/upload a CSV of "email,role" rows and send invites
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCreateUserInvite } from "@/hooks/useUserInvites";

export interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VALID_ROLES = new Set(["admin", "manager", "user"]);

interface ParsedRow {
  email: string;
  role: string;
}

function parseCsv(text: string): { rows: ParsedRow[]; invalidLines: string[] } {
  const rows: ParsedRow[] = [];
  const invalidLines: string[] = [];

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^email\s*,\s*role$/i.test(line)) return; // skip header row

      const [emailRaw, roleRaw] = line.split(",").map((part) => part?.trim());
      const email = emailRaw?.toLowerCase();
      const role = (roleRaw || "user").toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !VALID_ROLES.has(role)) {
        invalidLines.push(line);
        return;
      }

      rows.push({ email, role });
    });

  return { rows, invalidLines };
}

export function BulkInviteDialog({ open, onOpenChange }: BulkInviteDialogProps) {
  const [csvText, setCsvText] = useState("");
  const [processing, setProcessing] = useState(false);
  const createInvite = useCreateUserInvite();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleSend = async () => {
    const { rows, invalidLines } = parseCsv(csvText);

    if (rows.length === 0) {
      toast.error("No valid rows found. Use format: email,role (admin/manager/user)");
      return;
    }

    setProcessing(true);
    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await createInvite.mutateAsync({ email: row.email, role: row.role });
        succeeded++;
      } catch {
        failed++;
      }
    }

    setProcessing(false);

    if (succeeded > 0) {
      toast.success(`Sent ${succeeded} invitation${succeeded === 1 ? "" : "s"}`);
    }
    if (failed > 0) {
      toast.error(`${failed} invitation${failed === 1 ? "" : "s"} failed (duplicate or invalid)`);
    }
    if (invalidLines.length > 0) {
      toast.warning(`Skipped ${invalidLines.length} malformed line${invalidLines.length === 1 ? "" : "s"}`);
    }

    if (failed === 0 && invalidLines.length === 0) {
      setCsvText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Invite Users</DialogTitle>
          <DialogDescription>
            Paste or upload a CSV with one user per line: <code>email,role</code> (role is
            admin, manager, or user — defaults to user).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bulk-invite-csv">CSV Rows</Label>
            <Textarea
              id="bulk-invite-csv"
              placeholder={"jane@example.com,manager\njohn@example.com,user"}
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              disabled={processing}
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label htmlFor="bulk-invite-file" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={processing}>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV file
                </span>
              </Button>
            </Label>
            <input
              id="bulk-invite-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={processing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={processing || !csvText.trim()}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
