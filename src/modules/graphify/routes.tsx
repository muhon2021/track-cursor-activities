/**
 * Graphify Module Routes
 */
import { Route } from 'react-router-dom'
import { ModuleRoute } from '@/components/routing/ModuleRoute'
import GraphSearch from './pages/GraphSearch'
import EntityDetail from './pages/EntityDetail'
import GraphExplorer from './pages/GraphExplorer'

export const graphifyRoutes = (
  <Route element={<ModuleRoute module="graphify" requiresFeatureFlag="enableGraphify" />}>
    <Route path="/graphify/search" element={<GraphSearch />} />
    <Route path="/graphify/explorer" element={<GraphExplorer />} />
    <Route path="/graphify/entity/:id" element={<EntityDetail />} />
  </Route>
)
