import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { useUserDashboardPreferences } from '@/hooks/useUserDashboardPreferences';

interface DashboardCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardType: 'owner' | 'pm' | 'ic';
  availableWidgets: {
    slug: string;
    label: string;
    description: string;
  }[];
}

export function DashboardCustomizeModal({
  isOpen,
  onClose,
  dashboardType,
  availableWidgets,
}: DashboardCustomizeModalProps) {
  const { preferences, updateWidgetVisibility } = useUserDashboardPreferences(dashboardType);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleToggleWidget = (widgetSlug: string) => {
    const currentPref = preferences[widgetSlug];
    const currentVisibility = currentPref?.is_visible ?? true;
    updateWidgetVisibility.mutate({
      widgetSlug,
      isVisible: !currentVisibility,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Choose which cards to show on your dashboard and reorder them by dragging.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {availableWidgets.map((widget) => {
            const pref = preferences[widget.slug];
            const isVisible = pref?.is_visible ?? true;

            return (
              <div
                key={widget.slug}
                draggable
                onDragStart={() => setDraggedItem(widget.slug)}
                onDragEnd={() => setDraggedItem(null)}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-grab active:cursor-grabbing ${
                  draggedItem === widget.slug ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="h-4 w-4 text-slate-400" />

                <Checkbox
                  checked={isVisible}
                  onCheckedChange={() => handleToggleWidget(widget.slug)}
                />

                <div className="flex-1">
                  <p className="font-medium text-sm">{widget.label}</p>
                  <p className="text-xs text-slate-500">{widget.description}</p>
                </div>

                {isVisible ? (
                  <Eye className="h-4 w-4 text-blue-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
