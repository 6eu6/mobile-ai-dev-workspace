import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getAuthedUser } from '~/lib/auth/supabase.server';

/**
 * Per-user project (chat) sync, backed by the `projects` table with RLS.
 *  - GET                → list projects (url_id, description, updated_at).
 *  - GET ?id=<urlId>    → full project (messages + snapshot).
 *  - POST {url_id,...}  → upsert a project.
 *  - DELETE ?id=<urlId> → remove a project.
 */

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { user, supabase, headers } = await getAuthedUser(request, context);

  if (!user || !supabase) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    const { data, error } = await supabase
      .from('projects')
      .select('url_id, description, messages, snapshot, updated_at')
      .eq('user_id', user.id)
      .eq('url_id', id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers });
    }

    return Response.json({ project: data ?? null }, { headers });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('url_id, description, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }

  return Response.json({ projects: data ?? [] }, { headers });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { user, supabase, headers } = await getAuthedUser(request, context);

  if (!user || !supabase) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');

    if (!id) {
      return Response.json({ ok: false, error: 'id is required' }, { status: 400, headers });
    }

    const { error } = await supabase.from('projects').delete().eq('user_id', user.id).eq('url_id', id);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500, headers });
    }

    return Response.json({ ok: true }, { headers });
  }

  const body = (await request.json().catch(() => ({}))) as {
    url_id?: string;
    description?: string;
    messages?: unknown;
    snapshot?: unknown;
  };

  const urlId = (body.url_id ?? '').trim();

  if (!urlId) {
    return Response.json({ ok: false, error: 'url_id is required' }, { status: 400, headers });
  }

  const { error } = await supabase.from('projects').upsert(
    {
      user_id: user.id,
      url_id: urlId,
      description: body.description ?? null,
      messages: body.messages ?? [],
      snapshot: body.snapshot ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,url_id' },
  );

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers });
  }

  return Response.json({ ok: true }, { headers });
}
