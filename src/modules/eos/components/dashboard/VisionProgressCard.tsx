import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Eye } from "lucide-react";
import { useEOSDashboard } from "@/modules/eos/hooks/useEOSDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export function VisionProgressCard() {
  const { data, isLoading } = useEOSDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { annual, quarterly } = data?.visionProgress ?? { annual: 0, quarterly: 0 };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Vision Progress</CardTitle>
        <Eye className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Annual Goals</span>
            <span className="font-medium">{annual}%</span>
          </div>
          <Progress value={annual} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Quarterly Goals</span>
            <span className="font-medium">{quarterly}%</span>
          </div>
          <Progress value={quarterly} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
