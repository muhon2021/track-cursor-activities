import { salesSpaceRoutes } from "./salesRoutes";
import { knowledgeSpaceRoutes } from "./knowledgeRoutes";
import { operationsSpaceRoutes } from "./operationsRoutes";
import { eosSpaceRoutes } from "./eosRoutes";
import { legacyRedirectRoutes } from "./legacyRedirects";

/** All Four Spaces routes combined */
export const spaceRoutes = (
  <>
    {salesSpaceRoutes}
    {knowledgeSpaceRoutes}
    {operationsSpaceRoutes}
    {eosSpaceRoutes}
    {legacyRedirectRoutes}
  </>
);
