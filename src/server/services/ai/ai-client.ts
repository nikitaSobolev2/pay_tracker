import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

export type AiJsonRequest = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
};

export type AiImagePart = {
  readonly mediaType: string;
  readonly base64: string;
};

export type AiJsonResponse = {
  readonly content: string;
  readonly model: string;
};

type ChatCompletionResponse = {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
  }[];
};

type ChatMessage = {
  readonly role: "system" | "user";
  readonly content: unknown;
};

const DEFAULT_TIMEOUT_MS = 120_000;
/** Analysis is deterministic bookkeeping advice, so keep the model conservative. */
const TEMPERATURE = 0.2;

/** Thin wrapper over an OpenAI-compatible /chat/completions endpoint. */
export async function requestJsonCompletion(
  request: AiJsonRequest,
): Promise<AiJsonResponse> {
  return completeJson([
    { role: "system", content: request.systemPrompt },
    { role: "user", content: request.userPrompt },
  ]);
}

export async function requestJsonCompletionWithImages(input: {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly images: readonly AiImagePart[];
}): Promise<AiJsonResponse> {
  const imageParts = input.images.map((image) => ({
    type: "image_url",
    image_url: {
      url: `data:${image.mediaType};base64,${image.base64}`,
    },
  }));
  return completeJson([
    { role: "system", content: input.systemPrompt },
    {
      role: "user",
      content: [{ type: "text", text: input.userPrompt }, ...imageParts],
    },
  ]);
}

async function completeJson(
  messages: readonly ChatMessage[],
): Promise<AiJsonResponse> {
  const model = requireEnv("AI_MODEL_ID");
  const response = await postCompletion(messages, model);

  if (!response.ok) {
    throw await toAiRequestError(response);
  }

  return { content: readContent(await response.json()), model };
}

async function toAiRequestError(response: Response): Promise<AppServiceError> {
  const detail = await readErrorDetail(response);
  if (response.status === 429) {
    return new AppServiceError(
      ApiErrorCode.RateLimited,
      detail ?? "AI rate limited — wait a moment and try again",
    );
  }
  return new AppServiceError(
    ApiErrorCode.Internal,
    detail ?? `AI request failed with status ${response.status}`,
  );
}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const message =
      (typeof payload.error?.message === "string" && payload.error.message) ||
      (typeof payload.message === "string" && payload.message) ||
      null;
    return message ? message.slice(0, 280) : null;
  } catch {
    return null;
  }
}

async function postCompletion(
  messages: readonly ChatMessage[],
  model: string,
): Promise<Response> {
  try {
    return await fetch(`${readBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("AI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(readTimeoutMs()),
      body: JSON.stringify({
        model,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        messages,
      }),
    });
  } catch (error) {
    if (error instanceof AppServiceError) {
      throw error;
    }
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "AI service is unavailable",
    );
  }
}

function readContent(payload: unknown): string {
  const content = (payload as ChatCompletionResponse).choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      "AI returned an empty answer",
    );
  }
  return content;
}

function readBaseUrl(): string {
  return requireEnv("AI_BASE_URL").replace(/\/+$/, "");
}

function readTimeoutMs(): number {
  const configured = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AppServiceError(
      ApiErrorCode.Internal,
      `AI analysis is not configured: ${name} is missing`,
    );
  }
  return value;
}
