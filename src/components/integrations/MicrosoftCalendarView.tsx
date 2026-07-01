/**
 * Microsoft Teams-style Weekly Calendar View
 * Displays Outlook calendar events in a weekly grid format
 */

import { useMemo, useState } from 'react';
import { format, isSameDay, parseISO, differenceInMinutes, isToday, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Video, MapPin, RefreshCw, X, ExternalLink } from 'lucide-react';
import { useMicrosoftCalendar, OutlookCalendarEvent } from '@/hooks/useMicrosoftCalendar';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Time slots from 7 AM to 9 PM
const HOUR_START = 7;
const HOUR_END = 21;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const SLOT_HEIGHT = 60; // pixels per hour

interface MicrosoftCalendarViewProps {
  onClose?: () => void;
}

export function MicrosoftCalendarView({ onClose }: MicrosoftCalendarViewProps) {
  const {
    events,
    eventsByDate,
    isLoading,
    isFetching,
    error,
    weekStart,
    goToNextWeek,
    goToPreviousWeek,
    goToToday,
    refresh,
  } = useMicrosoftCalendar({ enabled: true });
  
  const [selectedEvent, setSelectedEvent] = useState<OutlookCalendarEvent | null>(null);
  
  // Generate days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);
  
  // Calculate event position and height
  const getEventStyle = (event: OutlookCalendarEvent) => {
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const clampedStart = Math.max(startHour, HOUR_START);
    const clampedEnd = Math.min(endHour, HOUR_END + 1);
    
    const top = (clampedStart - HOUR_START) * SLOT_HEIGHT;
    const height = Math.max((clampedEnd - clampedStart) * SLOT_HEIGHT, 24);
    
    return { top, height };
  };
  
  // Get status color
  const getStatusColor = (showAs?: string, isOnlineMeeting?: boolean) => {
    if (isOnlineMeeting) {
      return 'bg-purple-500 dark:bg-purple-600';
    }
    switch (showAs) {
      case 'busy':
        return 'bg-blue-500 dark:bg-blue-600';
      case 'tentative':
        return 'bg-amber-500 dark:bg-amber-600';
      case 'oof':
        return 'bg-violet-500 dark:bg-violet-600';
      case 'free':
        return 'bg-green-500 dark:bg-green-600';
      default:
        return 'bg-blue-500 dark:bg-blue-600';
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load calendar'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(weekStart, 'MMMM yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="p-2" /> {/* Time column header */}
          {weekDays.map((day) => (
            <div 
              key={day.toISOString()} 
              className={cn(
                "p-2 text-center border-l",
                isToday(day) && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(day, 'EEE')}
              </div>
              <div className={cn(
                "text-lg font-semibold",
                isToday(day) && "text-primary"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        
        {/* Time grid with events */}
        <div className="relative overflow-x-auto">
          <div 
            className="grid grid-cols-[60px_repeat(7,1fr)]"
            style={{ height: HOURS.length * SLOT_HEIGHT }}
          >
            {/* Time labels */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div 
                  key={hour}
                  className="absolute w-full text-xs text-muted-foreground text-right pr-2 -translate-y-1/2"
                  style={{ top: (hour - HOUR_START) * SLOT_HEIGHT }}
                >
                  {format(new Date().setHours(hour, 0), 'h a')}
                </div>
              ))}
            </div>
            
            {/* Day columns with events */}
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "relative border-l",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-dashed border-muted"
                      style={{ top: (hour - HOUR_START) * SLOT_HEIGHT }}
                    />
                  ))}
                  
                  {/* Events */}
                  {dayEvents.map((event) => {
                    const { top, height } = getEventStyle(event);
                    const duration = differenceInMinutes(
                      parseISO(event.end.dateTime),
                      parseISO(event.start.dateTime)
                    );
                    
                    return (
                      <Popover key={event.id}>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "absolute left-1 right-1 rounded-md px-2 py-1 text-left text-white overflow-hidden cursor-pointer transition-opacity hover:opacity-90",
                              getStatusColor(event.showAs, event.isOnlineMeeting)
                            )}
                            style={{ top, height }}
                          >
                            <div className="flex items-start gap-1">
                              {event.isOnlineMeeting && (
                                <Video className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">
                                  {event.subject || 'No title'}
                                </div>
                                {height > 40 && (
                                  <div className="text-xs opacity-80 truncate">
                                    {format(parseISO(event.start.dateTime), 'h:mm a')}
                                    {event.location?.displayName && (
                                      <span> · {event.location.displayName}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="flex items-start gap-2">
                              <div 
                                className={cn(
                                  "w-3 h-3 rounded-full mt-1.5 flex-shrink-0",
                                  getStatusColor(event.showAs, event.isOnlineMeeting)
                                )} 
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-base">
                                  {event.subject || 'No title'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(event.start.dateTime), 'EEEE, MMMM d')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(event.start.dateTime), 'h:mm a')} - {format(parseISO(event.end.dateTime), 'h:mm a')}
                                  <span className="ml-1">({duration} min)</span>
                                </p>
                              </div>
                            </div>
                            
                            {event.location?.displayName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{event.location.displayName}</span>
                              </div>
                            )}
                            
                            {event.isOnlineMeeting && (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1">
                                  <Video className="h-3 w-3" />
                                  Teams Meeting
                                </Badge>
                              </div>
                            )}
                            
                            {event.bodyPreview && (
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {event.bodyPreview}
                              </p>
                            )}
                            
                            {event.isOnlineMeeting && event.onlineMeeting?.joinUrl && (
                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={() => window.open(event.onlineMeeting?.joinUrl, '_blank')}
                              >
                                <Video className="mr-2 h-4 w-4" />
                                Join Teams Meeting
                                <ExternalLink className="ml-2 h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Teams Meeting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Busy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Tentative</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Free</span>
        </div>
      </div>
    </div>
  );
}
