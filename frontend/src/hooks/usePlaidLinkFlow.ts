import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { api } from "../api/client";

type ConnectPayload = {
  account_type: string;
  bank_name: string;
};

type UsePlaidLinkFlowOptions = {
  enabled: boolean;
  onSuccess: (publicToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
  onClose?: () => void;
};

export function usePlaidLinkFlow({ enabled, onSuccess, onError, onClose }: UsePlaidLinkFlowOptions) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  const loadToken = useCallback(async () => {
    setLoadingToken(true);
    try {
      const res = await api.createPlaidLinkToken();
      setLinkToken(res.link_token);
      return res.link_token;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not initialize Plaid";
      onError?.(msg);
      throw e;
    } finally {
      setLoadingToken(false);
    }
  }, [onError]);

  useEffect(() => {
    if (enabled) {
      loadToken().catch(() => {});
    }
  }, [enabled, loadToken]);

  const handlePlaidSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken) => {
      setOpening(false);
      await onSuccess(publicToken);
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: (err, metadata) => {
      setOpening(false);
      setPendingOpen(false);
      if (err) {
        onError?.(err.display_message ?? err.error_message ?? "Connection cancelled");
      } else if (metadata?.status === "requires_credentials") {
        onError?.("Sign-in was not completed. Please try again.");
      }
      onClose?.();
    },
  });

  useEffect(() => {
    if (pendingOpen && ready && linkToken) {
      open();
      setPendingOpen(false);
    }
  }, [pendingOpen, ready, linkToken, open]);

  const openPlaidLink = useCallback(async () => {
    setOpening(true);
    try {
      if (!linkToken) {
        await loadToken();
        setPendingOpen(true);
        return;
      }
      if (ready) {
        open();
      } else {
        setPendingOpen(true);
      }
    } catch {
      setOpening(false);
    }
  }, [linkToken, loadToken, ready, open]);

  return {
    openPlaidLink,
    loadingToken,
    opening: opening || pendingOpen,
    ready: Boolean(linkToken && ready),
  };
}

export type { ConnectPayload };
