import { useEffect, useMemo, useRef, useState } from "react";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { DISPOSABLE_DOMAINS } from "@/lib/disposable-domains";

export const EMAIL_DEBOUNCE_MS = 1000;

export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface EmailValidationState {
  isValid: boolean;
  formatValid: boolean;
  isDisposable: boolean;
  mxValid: boolean | null;
  isPending: boolean;
  error: string | null;
}

interface EmailValidationApiResult {
  valid: boolean;
  steps: Array<{ step: string; passed: boolean; message?: string }>;
  domain?: string;
}

export const EMPTY_EMAIL_VALIDATION: EmailValidationState = {
  isValid: false,
  formatValid: false,
  isDisposable: false,
  mxValid: null,
  isPending: false,
  error: null,
};

function extractDomain(email: string): string | null {
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1) return null;
  return email.slice(atIndex + 1).trim().toLowerCase();
}

export function validateEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return EMAIL_REGEX.test(trimmed) && trimmed.length <= 254;
}

export function isDisposableEmailDomain(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export function validateEmailLocally(email: string): Pick<EmailValidationState, "formatValid" | "isDisposable"> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { formatValid: false, isDisposable: false };
  }

  return {
    formatValid: validateEmailFormat(trimmed),
    isDisposable: isDisposableEmailDomain(trimmed),
  };
}

export async function validateEmailMxRemote(email: string): Promise<Pick<EmailValidationState, "mxValid" | "error">> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { mxValid: null, error: null };
  }

  try {
    const result = await invokeEdgeFunction<EmailValidationApiResult>("validate-email", { email: trimmed });
    const mxStep = result.steps.find((step) => step.step === "mx");

    if (!mxStep) {
      return {
        mxValid: result.valid,
        error: result.valid ? null : "Email domain could not be verified",
      };
    }

    return {
      mxValid: mxStep.passed,
      error: mxStep.passed ? null : mxStep.message ?? "No MX records found for domain",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email verification failed";
    return { mxValid: false, error: message };
  }
}

export function aggregateEmailValidation(
  local: Pick<EmailValidationState, "formatValid" | "isDisposable">,
  mxValid: boolean | null,
  isPending: boolean,
  error: string | null
): EmailValidationState {
  const formatValid = local.formatValid;
  const isDisposable = local.isDisposable;

  const mxPassed = mxValid === true;
  const isValid = formatValid && !isDisposable && mxPassed && !isPending;

  let resolvedError = error;
  if (!resolvedError) {
    if (!formatValid) {
      resolvedError = "Invalid email format";
    } else if (isDisposable) {
      resolvedError = "Disposable email domains are not allowed";
    } else if (mxValid === false) {
      resolvedError = "Email domain does not have valid mail records";
    }
  }

  return {
    isValid,
    formatValid,
    isDisposable,
    mxValid,
    isPending,
    error: isValid ? null : resolvedError,
  };
}

export function useEmailValidation(email: string): EmailValidationState {
  const [mxValid, setMxValid] = useState<boolean | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const trimmed = email.trim();
  const local = validateEmailLocally(trimmed);
  const shouldValidateRemote = trimmed.length >= 3 && local.formatValid && !local.isDisposable;

  useEffect(() => {
    if (!shouldValidateRemote) {
      requestIdRef.current += 1;
      setMxValid(null);
      setIsPending(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsPending(true);
    setMxValid(null);
    setError(null);

    const timer = window.setTimeout(() => {
      void validateEmailMxRemote(trimmed).then((remote) => {
        if (requestIdRef.current !== currentRequestId) return;
        setMxValid(remote.mxValid);
        setError(remote.error);
        setIsPending(false);
      });
    }, EMAIL_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [trimmed, shouldValidateRemote]);

  return useMemo(
    () => aggregateEmailValidation(local, mxValid, isPending, error),
    [local.formatValid, local.isDisposable, mxValid, isPending, error]
  );
}
