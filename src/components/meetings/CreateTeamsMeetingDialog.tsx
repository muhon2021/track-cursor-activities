/**
 * Dialog for creating Microsoft Teams meetings
 * Includes form validation, attendee management, and error handling
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addHours } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Loader2,
  Plus,
  X,
  Video,
  Clock,
  Users,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useCreateTeamsMeeting } from "@/hooks/useCreateTeamsMeeting";
import { createTeamsMeetingSchema, CreateTeamsMeetingInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface CreateTeamsMeetingDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (joinUrl: string, meetingId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTeamsMeetingDialog({ trigger, onSuccess, open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateTeamsMeetingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendeeError, setAttendeeError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdMeetingUrl, setCreatedMeetingUrl] = useState("");
  const [copied, setCopied] = useState(false);
  
  const createMeeting = useCreateTeamsMeeting();

  // Set default times: now + 1 hour for start, now + 2 hours for end
  const getDefaultStartTime = () => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15); // Round to next 15 min
    now.setHours(now.getHours() + 1);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  };

  const getDefaultEndTime = () => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    now.setHours(now.getHours() + 2);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  };

  const form = useForm<CreateTeamsMeetingInput>({
    resolver: zodResolver(createTeamsMeetingSchema),
    defaultValues: {
      title: "",
      startDateTime: getDefaultStartTime(),
      endDateTime: getDefaultEndTime(),
      attendees: [],
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        startDateTime: getDefaultStartTime(),
        endDateTime: getDefaultEndTime(),
        attendees: [],
      });
      setShowSuccess(false);
      setCreatedMeetingUrl("");
      setAttendeeInput("");
      setAttendeeError("");
      setCopied(false);
    }
  }, [open, form]);

  // Calculate duration for display
  const watchStart = form.watch("startDateTime");
  const watchEnd = form.watch("endDateTime");
  const duration = (() => {
    try {
      const start = new Date(watchStart);
      const end = new Date(watchEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const diffMs = end.getTime() - start.getTime();
      if (diffMs <= 0) return null;
      const minutes = Math.round(diffMs / 60000);
      if (minutes < 60) return `${minutes} minutes`;
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    } catch {
      return null;
    }
  })();

  const attendees = form.watch("attendees") || [];

  const addAttendee = () => {
    const email = attendeeInput.trim().toLowerCase();
    setAttendeeError("");
    
    if (!email) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAttendeeError("Invalid email address");
      return;
    }
    
    // Check for duplicates
    if (attendees.includes(email)) {
      setAttendeeError("Email already added");
      return;
    }
    
    form.setValue("attendees", [...attendees, email]);
    setAttendeeInput("");
  };

  const removeAttendee = (email: string) => {
    form.setValue("attendees", attendees.filter(a => a !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAttendee();
    }
  };

  const onSubmit = async (data: CreateTeamsMeetingInput) => {
    try {
      const result = await createMeeting.mutateAsync(data);
      setCreatedMeetingUrl(result.joinUrl);
      setShowSuccess(true);
      onSuccess?.(result.joinUrl, result.dbMeetingId);
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('[CreateTeamsMeetingDialog] Submit error:', error);
    }
  };

  const copyJoinUrl = async () => {
    if (!createdMeetingUrl) return;
    try {
      await navigator.clipboard.writeText(createdMeetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Video className="mr-2 h-4 w-4" />
              Create Teams Meeting
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Create Teams Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a new Microsoft Teams meeting. Attendees will receive an invite.
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="space-y-6 py-4">
            {/* Success Header */}
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full blur-xl opacity-50"></div>
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500 relative z-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">Meeting Created Successfully!</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your Teams meeting has been scheduled. Share the link below with attendees.
              </p>
            </div>
            
            {/* Meeting Link Card */}
            <div className="rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/30 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-green-600 dark:text-green-400" />
                <Label className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Meeting Join Link
                </Label>
              </div>
              
              <div className="bg-background/80 dark:bg-background/90 rounded-lg border border-green-200 dark:border-green-800 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-transparent text-foreground break-all px-2 py-1.5">
                    {createdMeetingUrl}
                  </code>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-green-200 dark:border-green-800">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyJoinUrl}
                    className={cn(
                      "flex-1 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950 transition-all",
                      copied && "bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600"
                    )}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(createdMeetingUrl, '_blank')}
                    className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Meeting
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Link copied to clipboard automatically
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="min-w-[100px]"
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowSuccess(false);
                  form.reset({
                    title: "",
                    startDateTime: getDefaultStartTime(),
                    endDateTime: getDefaultEndTime(),
                    attendees: [],
                  });
                }}
                className="min-w-[140px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Another
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Weekly Team Sync"
                        {...field}
                        disabled={createMeeting.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={createMeeting.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={createMeeting.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {duration && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {duration}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendees (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="attendee@example.com"
                    value={attendeeInput}
                    onChange={(e) => {
                      setAttendeeInput(e.target.value);
                      setAttendeeError("");
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={createMeeting.isPending}
                    className={cn(attendeeError && "border-destructive")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addAttendee}
                    disabled={createMeeting.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {attendeeError && (
                  <p className="text-sm text-destructive">{attendeeError}</p>
                )}
                
                {attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {attendees.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="pl-2 pr-1 py-1 gap-1"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeAttendee(email)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                          disabled={createMeeting.isPending}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <FormDescription className="text-xs">
                  Press Enter to add each attendee. They'll receive an email invite.
                </FormDescription>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createMeeting.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMeeting.isPending}>
                  {createMeeting.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-4 w-4" />
                      Create Meeting
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
