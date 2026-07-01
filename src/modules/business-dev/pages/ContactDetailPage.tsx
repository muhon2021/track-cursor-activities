/**
 * Contact Detail Page - View, edit, and delete a contact
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Save,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import {
  useContact,
  useUpdateContact,
  useDeleteContact,
  useCreateLeadFollowUp,
  useUpdateLeadFollowUp,
} from "../hooks/useContacts";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { useContactMeetings } from "@/modules/meetings/hooks/useContactMeetings";
import type { ContactFormData } from "../types";

const FOLLOWUP_COLORS: Record<string, string> = {
  new: "#6b7280",
  contacted: "#3b82f6",
  interested: "#22c55e",
  not_interested: "#ef4444",
  converted: "#8b5cf6",
  dormant: "#f59e0b",
};

const FOLLOWUP_STATUSES = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "dormant",
] as const;

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: contact, isLoading } = useContact(id!);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const createFollowUp = useCreateLeadFollowUp();
  const updateFollowUp = useUpdateLeadFollowUp();
  const { data: contactMeetings = [] } = useContactMeetings(id!);

  const [form, setForm] = useState<Partial<ContactFormData>>({});

  const startEdit = () => {
    if (!contact) return;
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      title: contact.title || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

  const handleSave = () => {
    if (!contact || !form.first_name?.trim()) return;
    updateContact.mutate(
      { id: contact.id, data: form },
      { onSuccess: () => setEditing(false) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Contact not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/contacts")}
        >
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contacts")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {contact.first_name} {contact.last_name || ""}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {contact.title && (
              <span className="text-sm text-muted-foreground">
                {contact.title}
              </span>
            )}
            {contact.company && (
              <Badge variant="secondary">
                <Building2 className="h-3 w-3 mr-1" />
                {contact.company}
              </Badge>
            )}
            {contact.followup && (
              <Badge
                variant="outline"
                style={{
                  borderColor: FOLLOWUP_COLORS[contact.followup.status],
                  color: FOLLOWUP_COLORS[contact.followup.status],
                }}
              >
                {contact.followup.status.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={
                  !form.first_name?.trim() || updateContact.isPending
                }
              >
                <Save className="h-4 w-4 mr-1" />
                {updateContact.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{contact.first_name}{" "}
                      {contact.last_name || ""}" and any associated follow-up
                      records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() =>
                        deleteContact.mutate(contact.id, {
                          onSuccess: () => navigate("/contacts"),
                        })
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Data Source */}
      <DataSourceBadge
        dataSource={(contact as any).data_source}
        lastSyncedAt={(contact as any).last_synced_at}
        externalUrl={(contact as any).external_url}
        variant="card"
      />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input
                      value={form.first_name || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, first_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={form.last_name || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, last_name: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.phone || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Company</Label>
                    <Input
                      value={form.company || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, company: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={form.title || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, title: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{contact.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{contact.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Company</p>
                    <p className="font-medium">{contact.company || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-medium">{contact.title || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Last Contacted</p>
                    <p className="font-medium">
                      {contact.last_contacted_at
                        ? new Date(contact.last_contacted_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {contact.notes && !editing && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}

            {contact.tags && contact.tags.length > 0 && !editing && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground font-medium mb-2">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meetings + Follow-up sidebar */}
        <div className="space-y-6">
          {/* Contact Meetings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" />
                Meetings ({contactMeetings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contactMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No meetings linked to this contact.
                </p>
              ) : (
                <div className="space-y-2">
                  {contactMeetings.slice(0, 5).map((cm: any) => {
                    const meeting = cm.meeting;
                    if (!meeting) return null;
                    return (
                      <button
                        key={cm.id}
                        className="w-full text-left rounded-md border p-3 hover:bg-accent/50 transition-colors"
                        onClick={() => navigate(`/meetings/${meeting.slug || meeting.id}`)}
                      >
                        <p className="font-medium text-sm">{meeting.title}</p>
                        {meeting.scheduled_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(meeting.scheduled_at).toLocaleDateString()}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {contactMeetings.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{contactMeetings.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Follow-up */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Follow-up</CardTitle>
          </CardHeader>
          <CardContent>
            {contact.followup ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {FOLLOWUP_STATUSES.map((status) => (
                      <button
                        key={status}
                        className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
                        style={{
                          backgroundColor:
                            contact.followup?.status === status
                              ? `${FOLLOWUP_COLORS[status]}20`
                              : "transparent",
                          borderColor: FOLLOWUP_COLORS[status],
                          color: FOLLOWUP_COLORS[status],
                        }}
                        onClick={() =>
                          updateFollowUp.mutate({
                            id: contact.followup!.id,
                            data: { status },
                          })
                        }
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priority</p>
                  <div className="flex gap-1">
                    {(["low", "medium", "high"] as const).map((p) => (
                      <button
                        key={p}
                        className={`rounded px-3 py-1 text-xs font-medium border transition-colors ${
                          contact.followup?.priority === p
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                        onClick={() =>
                          updateFollowUp.mutate({
                            id: contact.followup!.id,
                            data: { priority: p },
                          })
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {contact.followup.next_follow_up && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Next Follow-up
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(
                        contact.followup.next_follow_up
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {contact.followup.follow_up_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {contact.followup.follow_up_notes}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  No follow-up record
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    createFollowUp.mutate({ contactId: contact.id })
                  }
                  disabled={createFollowUp.isPending}
                >
                  {createFollowUp.isPending
                    ? "Creating..."
                    : "Create Follow-up"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
