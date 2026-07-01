import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface TranscriptViewerProps {
  transcript: string;
  title?: string;
  description?: string;
  maxHeight?: string;
  className?: string;
}

export function TranscriptViewer({
  transcript,
  title = "Meeting Transcript",
  description = "Full recording transcription",
  maxHeight = "max-h-96",
  className,
}: TranscriptViewerProps) {
  if (!transcript) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className={`${maxHeight} rounded-lg border bg-muted/50 p-4`}>
          <p className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{transcript}</p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
