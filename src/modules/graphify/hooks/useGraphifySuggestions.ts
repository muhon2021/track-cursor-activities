import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys, cacheConfig } from '@/lib/cache'
import { graphSearch, type GraphEntityResult } from '@/lib/graphify'
import { dedupeSearchEntities } from '@/lib/graphify-utils'

export function useGraphifySuggestions(term: string, enabled = true) {
  const [debounced, setDebounced] = useState(term.trim())

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(term.trim()), 280)
    return () => window.clearTimeout(handle)
  }, [term])

  const query = useQuery({
    queryKey: queryKeys.graphify.suggestions(debounced),
    queryFn: async () => {
      const res = await graphSearch(debounced, { limit: 10, suggest: true })
      return dedupeSearchEntities(res.entities ?? [])
    },
    enabled: enabled && debounced.length >= 2,
    staleTime: cacheConfig.staleTime.short,
    refetchOnWindowFocus: false,
  })

  return {
    suggestions: query.data ?? [],
    isLoading: query.isFetching,
    debouncedTerm: debounced,
  }
}

export type { GraphEntityResult }
