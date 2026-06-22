import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';

function getApiKey(context: LoaderFunctionArgs['context']): string | undefined {
  const env = (context as unknown as { cloudflare?: { env?: Record<string, string> } }).cloudflare?.env;
  const key = env?.E2B_API_KEY;

  return key || (typeof process !== 'undefined' ? process.env?.E2B_API_KEY : undefined);
}

export async function loader({ context }: LoaderFunctionArgs) {
  const hasKey = Boolean(getApiKey(context));
  console.log(`[api/test-sandbox] health check: configured=${hasKey}`);

  return json({ ok: true, configured: hasKey });
}
