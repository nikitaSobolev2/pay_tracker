"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.signIn.username({
        username,
        password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Login failed");
      }
      router.replace("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell brand={tApp("name")} title={t("login")}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {t("login")}
          </Button>
          <Link
            href="/login/code"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex h-12 min-h-12 w-full items-center justify-center rounded-xl text-base font-medium sm:h-11 sm:min-h-11",
            )}
          >
            {t("loginWithCode")}
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("register")}
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
