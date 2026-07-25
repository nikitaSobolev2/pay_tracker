"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        username,
        password,
        name: username,
        email: `${username}@paytracker.local`,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Register failed");
      }
      router.replace("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell brand={tApp("name")} title={t("register")}>
      <form className="flex flex-col" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              {t("username")}
            </Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              className="h-12 min-h-12 w-full rounded-xl bg-background/60 px-3.5 text-base sm:h-11 sm:min-h-11 md:text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              {t("password")}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-12 min-h-12 w-full rounded-xl bg-background/60 px-3.5 text-base sm:h-11 sm:min-h-11 md:text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              {t("confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="h-12 min-h-12 w-full rounded-xl bg-background/60 px-3.5 text-base sm:h-11 sm:min-h-11 md:text-sm"
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 min-h-12 w-full rounded-xl text-base font-medium sm:h-11 sm:min-h-11"
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {t("register")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("login")}
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
