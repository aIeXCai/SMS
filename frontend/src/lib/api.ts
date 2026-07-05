const API_BASE = 'http://127.0.0.1:8000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

type ParamValue = string | number | (string | number)[];
type ParamRecord = Record<string, ParamValue>;

function buildURL(path: string, params?: ParamRecord): string {
  const cleanPath = path.replace(/\/+$/, '');
  const url = `${API_BASE}${cleanPath}`;
  if (!params) return url;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)));
    } else {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    params?: ParamRecord;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildURL(path, options?.params);
  const token = getToken();

  const headers: Record<string, string> = { ...options?.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (options?.body && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);

  if (res.status === 401) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      (errorBody as Record<string, unknown>).message as string ||
      (errorBody as Record<string, unknown>).detail as string ||
      `Request failed: ${res.status}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, params?: ParamRecord) =>
    request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, params?: ParamRecord) =>
    request<T>('POST', path, { body, params }),
  put: <T>(path: string, body?: unknown, params?: ParamRecord) =>
    request<T>('PUT', path, { body, params }),
  delete: <T>(path: string, params?: ParamRecord) =>
    request<T>('DELETE', path, { params }),

  // FormData upload — no Content-Type so browser sets multipart boundary
  upload: <T>(path: string, formData: FormData) => {
    const token = getToken();
    const cleanPath = path.replace(/\/+$/, '');
    return fetch(`${API_BASE}${cleanPath}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error((error as Record<string, unknown>).message as string || (error as Record<string, unknown>).detail as string || 'Request failed');
      }
      return res.json() as Promise<T>;
    });
  },

  // File download — returns raw Response so callers can .blob() or read headers
  downloadBlob: async (path: string, params?: ParamRecord) => {
    const token = getToken();
    const url = buildURL(path, params);
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error((error as Record<string, unknown>).message as string || (error as Record<string, unknown>).detail as string || 'Download failed');
    }
    return res;
  },
};
