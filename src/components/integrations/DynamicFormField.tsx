/**
 * Dynamic Form Field Component
 * Renders integration configuration fields based on field type
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  IntegrationField,
  validateFieldValue,
  maskSensitiveValue,
} from '@/lib/integration-utils';

interface DynamicFormFieldProps {
  field: IntegrationField;
  value: string;
  onChange: (value: string) => void;
  showMasked?: boolean;
}

export function DynamicFormField({
  field,
  value,
  onChange,
  showMasked = true,
}: DynamicFormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();

  // Validate on change
  useEffect(() => {
    if (touched && value) {
      const validation = validateFieldValue(field, value);
      setValidationError(validation.valid ? undefined : validation.error);
    }
  }, [value, field, touched]);

  const handleBlur = () => {
    setTouched(true);
    const validation = validateFieldValue(field, value);
    setValidationError(validation.valid ? undefined : validation.error);
  };

  const renderField = () => {
    // For sensitive fields, show masked value if not editing
    const displayValue =
      field.is_sensitive && showMasked && value && !showPassword
        ? maskSensitiveValue(value)
        : value;

    switch (field.field_type) {
      case 'select':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.select_options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || ''}
            rows={4}
            className={validationError ? 'border-destructive' : ''}
          />
        );

      case 'password':
        return (
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={displayValue}
              onChange={(e) => onChange(e.target.value)}
              onBlur={handleBlur}
              onFocus={() => {
                if (field.is_sensitive && showMasked) {
                  setShowPassword(true);
                }
              }}
              placeholder={field.placeholder || ''}
              className={`pr-10 ${validationError ? 'border-destructive' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        );

      default:
        // text, email, url
        const inputType = field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text';

        // For sensitive text fields
        if (field.is_sensitive) {
          return (
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={displayValue}
                onChange={(e) => onChange(e.target.value)}
                onBlur={handleBlur}
                onFocus={() => {
                  if (showMasked) {
                    setShowPassword(true);
                  }
                }}
                placeholder={field.placeholder || ''}
                className={`pr-10 ${validationError ? 'border-destructive' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          );
        }

        return (
          <Input
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder || ''}
            className={validationError ? 'border-destructive' : ''}
          />
        );
    }
  };

  const showValidation = touched && value;
  const isValid = !validationError && value && field.is_required;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.field_key}>
        {field.label}
        {field.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField()}

      {/* Help text */}
      {field.help_text && !validationError && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}

      {/* Validation feedback */}
      {showValidation && (
        <div className="flex items-center gap-1">
          {validationError ? (
            <>
              <AlertCircle className="h-3 w-3 text-destructive" />
              <p className="text-xs text-destructive">{validationError}</p>
            </>
          ) : isValid ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <p className="text-xs text-green-600">Valid</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
