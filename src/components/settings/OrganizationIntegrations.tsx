/**
 * Read-only org integration hub summary for user Settings.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrgIntegrationOverview } from '@/hooks/useOrgIntegrationOverview';
import { getProviderIcon } from '@/lib/integration-utils';
import { Building2, Loader2, Star } from 'lucide-react';

export function OrganizationIntegrations() {
  const { data: categories, isLoading, error } = useOrgIntegrationOverview();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Organization Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load organization integration settings. Ask an administrator to run
            database migrations, then try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organization Integrations
        </CardTitle>
        <CardDescription>
          Services your administrator connected and set as defaults for the organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(categories ?? []).map((category) => (
            <div
              key={category.categorySlug}
              className="rounded-lg border bg-muted/20 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{category.categoryName}</p>
                  <p className="text-xs text-muted-foreground">
                    Organization default only — admin picks one provider for everyone
                  </p>
                </div>
                {category.defaultProviderName ? (
                  <Badge variant="default" className="gap-1 shrink-0">
                    <Star className="h-3 w-3 fill-current" />
                    Default: {category.defaultProviderName}
                  </Badge>
                ) : category.isConfigured ? (
                  <Badge variant="outline" className="shrink-0">
                    Default not set
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Not configured
                  </Badge>
                )}
              </div>

              {!category.isConfigured ? (
                <p className="text-sm text-muted-foreground">
                  No {category.categoryName.toLowerCase()} provider is connected yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {category.providers.map((provider) => {
                    const ProviderIcon = getProviderIcon(provider.slug);
                    return (
                      <li
                        key={provider.slug}
                        className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ProviderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{provider.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="default" className="text-xs">
                            Connected
                          </Badge>
                          {provider.isDefault && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Star className="h-3 w-3" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
        ))}
      </CardContent>
    </Card>
  );
}
