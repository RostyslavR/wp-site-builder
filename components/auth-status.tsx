"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuthStatusData {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  authMethod?: string;
  error?: string;
}

/** Shows whether the `claude` CLI this server shells out to is currently
 * authenticated, and walks through `claude auth login`'s device-code flow
 * without leaving the dashboard — mainly useful on a fresh machine/
 * environment where that login was never done (the actual cause of a 401
 * "Invalid authentication credentials" error, not a bug in this app's own
 * request handling). The flow has two steps: open the printed URL and
 * authorize in the browser, then paste the short code it gives back here —
 * the CLI process is left waiting for exactly that code on its stdin. */
export function AuthStatus() {
  const [status, setStatus] = useState<AuthStatusData | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refreshStatus() {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ loggedIn: false }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function handleLogin() {
    setStarting(true);
    setMessage(null);
    setLoginUrl(null);
    setCode("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        setLoginUrl(data.url);
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setMessage("Couldn't find a login URL in the CLI's output — check the server's own logs.");
      }
    } catch {
      setMessage("Failed to start the login process.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitCode() {
    if (!code.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? "Logged in." : "Login failed."));
      if (data.success) {
        setLoginUrl(null);
        setCode("");
        refreshStatus();
      }
    } catch {
      setMessage("Failed to submit the code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {status?.loggedIn ? (
          <Badge variant="default">
            Logged in{status.email ? ` — ${status.email}` : ""}
            {status.subscriptionType ? ` (${status.subscriptionType})` : ""}
          </Badge>
        ) : (
          <Badge variant="destructive">Not logged in</Badge>
        )}
        <Button variant="outline" size="sm" onClick={handleLogin} disabled={starting}>
          {starting ? "Starting…" : "Login"}
        </Button>
        <Button variant="ghost" size="sm" onClick={refreshStatus}>
          Refresh
        </Button>
      </div>

      {loginUrl && (
        <div className="space-y-1.5 rounded-lg border border-input p-2">
          <p className="text-xs text-muted-foreground">
            Authorize in the browser tab that opened (or{" "}
            <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="underline">
              open it again
            </a>
            ), then paste the code it gives you back here:
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste authentication code"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitCode();
              }}
            />
            <Button variant="secondary" size="sm" onClick={handleSubmitCode} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
