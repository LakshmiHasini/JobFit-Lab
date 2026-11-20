/** Same-origin API requests with errors that are safe to show in the interface. */
export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      credentials: 'same-origin',
      ...(body === undefined
        ? {}
        : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Cannot connect to JobFit Lab. Check that the app is running and try again.');
  }
  let data: T & { error?: unknown };
  try {
    data = await response.json();
  } catch {
    throw Object.assign(new Error('The service is unavailable. Please try again.'), {
      status: response.status,
    });
  }
  if (!response.ok) {
    const message =
      data && typeof data.error === 'string' && data.error.trim()
        ? data.error
        : response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'The request could not be completed. Please try again.';
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}
