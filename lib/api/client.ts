export async function apiMutate<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<{ ok: true; data?: T } | { ok: false; error: string; unauthorized?: boolean }> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'X-Requested-With': 'XMLHttpRequest',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const parsed = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: T; error?: string }
      | null;

    if (response.status === 401) {
      return {
        ok: false,
        unauthorized: true,
        error: parsed?.error ?? 'Sessão expirada. Faça login novamente.',
      };
    }

    if (!response.ok || !parsed?.ok) {
      return {
        ok: false,
        error: parsed?.error ?? 'Não foi possível concluir a operação.',
      };
    }

    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      error: 'Falha de comunicação com o servidor. Recarregue a página e tente novamente.',
    };
  }
}
