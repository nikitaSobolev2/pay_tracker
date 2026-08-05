import { apiFetch } from "@/lib/api/client";

export function fetchLinkPreview(url: string) {
  return apiFetch<{ imageUrl: string | null }>("/api/link-preview", {
    method: "POST",
    body: { url },
  });
}
