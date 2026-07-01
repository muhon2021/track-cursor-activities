/**
 * Hook for fetching Microsoft Outlook calendar events
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { getCalendarEvents, OutlookCalendarEvent } from '@/lib/microsoftTeamsMeetingService';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay, format } from 'date-fns';

export interface UseMicrosoftCalendarOptions {
  enabled?: boolean;
}

export function useMicrosoftCalendar(options: UseMicrosoftCalendarOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  
  // State for current week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  
  // Calculate week boundaries
  const weekStart = useMemo(() => startOfDay(currentWeekStart), [currentWeekStart]);
  const weekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 0 }), [currentWeekStart]);
  
  // Query for fetching calendar events
  const calendarQuery = useQuery({
    queryKey: ['microsoft-calendar', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => getCalendarEvents(weekStart, weekEnd),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  });
  
  // Navigation functions
  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  }, []);
  
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  }, []);
  
  const goToToday = useCallback(() => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  }, []);
  
  // Refresh calendar data
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['microsoft-calendar'] });
  }, [queryClient]);
  
  // Group events by date for easier rendering
  const eventsByDate = useMemo(() => {
    const events = calendarQuery.data || [];
    const grouped: Record<string, OutlookCalendarEvent[]> = {};
    
    events.forEach(event => {
      const dateKey = format(new Date(event.start.dateTime), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  }, [calendarQuery.data]);
  
  return {
    events: calendarQuery.data || [],
    eventsByDate,
    isLoading: calendarQuery.isLoading,
    isFetching: calendarQuery.isFetching,
    error: calendarQuery.error,
    weekStart,
    weekEnd,
    currentWeekStart,
    goToNextWeek,
    goToPreviousWeek,
    goToToday,
    refresh,
  };
}

export type { OutlookCalendarEvent };
