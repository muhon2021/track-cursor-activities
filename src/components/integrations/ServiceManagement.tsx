/**
 * Service Management Component
 * Manages integration services (enable/disable, set default)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Star, Loader2, DollarSign } from 'lucide-react';
import { IntegrationService } from '@/lib/integration-utils';
import { formatCost } from '@/lib/integration-utils';

interface ServiceManagementProps {
  services: IntegrationService[];
  onToggleService: (serviceId: string, enabled: boolean) => void;
  onSetDefault: (serviceId: string) => void;
  isLoading?: boolean;
}

export function ServiceManagement({
  services,
  onToggleService,
  onSetDefault,
  isLoading = false,
}: ServiceManagementProps) {
  if (services.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Services</CardTitle>
        <CardDescription>
          Enable or disable specific services and set your default
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2 transition-colors
                ${service.is_default ? 'border-primary bg-primary/5' : 'border-border'}
                ${!service.enabled ? 'opacity-60' : ''}
              `}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{service.name}</p>
                  {service.is_default && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Default
                    </Badge>
                  )}
                  {(service as any).is_beta && (
                    <Badge variant="outline" className="text-xs">
                      Beta
                    </Badge>
                  )}
                </div>

                {service.description && (
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                )}

                {/* Features */}
                {service.features && Object.keys(service.features).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(service.features)
                      .filter(([_, enabled]) => enabled)
                      .map(([feature]) => (
                        <Badge key={feature} variant="secondary" className="text-xs capitalize">
                          {feature.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                  </div>
                )}

                {/* Cost info */}
                {service.has_cost && service.cost_model && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    {service.cost_model.type === 'per_api_call' && (
                      <span>{formatCost(service.cost_model.rate || 0)} per call</span>
                    )}
                    {service.cost_model.type === 'per_token' && (
                      <span>{formatCost(service.cost_model.rate || 0)} per 1K tokens</span>
                    )}
                    {service.cost_model.type === 'flat' && (
                      <span>{formatCost(service.cost_model.rate || 0)}/month</span>
                    )}
                    {service.cost_model.type === 'tiered' && <span>Tiered pricing</span>}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 ml-4">
                {/* Set as default button */}
                {!service.is_default && service.enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetDefault(service.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Enable/disable toggle */}
                <Switch
                  checked={service.enabled}
                  onCheckedChange={(checked) => onToggleService(service.id, checked)}
                  disabled={isLoading || service.is_default}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Help text */}
        <div className="mt-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
          <p>
            <strong>Default service</strong> will be used when no specific service is requested. You
            cannot disable the default service - set another service as default first.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
