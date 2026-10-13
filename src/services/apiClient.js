const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '')
const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
const apiTimeoutMs = Number.isInteger(configuredTimeout) && configuredTimeout >= 1000 && configuredTimeout <= 120000 ? configuredTimeout : 15000

let authTokenProvider = null
let unauthorizedHandler = null

export class ApiError extends Error {
  constructor(message, { status = null, data = null, uncertain = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.uncertain = uncertain
  }
}

export function setAuthTokenProvider(provider) {
  if (provider !== null && typeof provider !== 'function') {
    throw new TypeError('The authentication token provider must be a function or null.')
  }
  authTokenProvider = provider
}

export function setUnauthorizedHandler(handler) {
  if (handler !== null && typeof handler !== 'function') throw new TypeError('The unauthorized handler must be a function or null.')
  unauthorizedHandler = handler
}

const requireBaseUrl = () => {
  if (!apiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL. Add it to your local .env file before making API requests.')
  }
  return apiBaseUrl
}

const requestUrl = (path) => `${requireBaseUrl()}/${String(path).replace(/^\/+/, '')}`

const responseData = async (response) => {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()

  const text = await response.text()
  return text || null
}

const errorMessage = (data, fallback) => {
  if (typeof data === 'string' && data) return data
  if (data?.message) return data.message
  return fallback
}

export async function request(path, { method = 'GET', body, headers = {}, signal, timeoutMs = apiTimeoutMs } = {}) {
  const url = requestUrl(path)
  const token = authTokenProvider ? await authTokenProvider() : null
  const isWrite = method !== 'GET' && !String(path).endsWith('/auth/login')
  const requestHeaders = { Accept: 'application/json', ...headers }

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (token) requestHeaders.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort()
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (response.status === 401 && unauthorizedHandler) {
      const currentToken = authTokenProvider ? await authTokenProvider() : null
      if (token === currentToken) unauthorizedHandler()
    }
    const data = await responseData(response)
    if (!response.ok) {
      throw new ApiError(errorMessage(data, `API request failed with status ${response.status}.`), {
        status: response.status,
        data,
        uncertain: isWrite && response.status >= 500,
      })
    }
    return data
  } catch (error) {
    if (timedOut) throw new ApiError('The API request timed out.', { uncertain: isWrite })
    if (error instanceof ApiError || error.name === 'AbortError') throw error
    if (error instanceof SyntaxError) throw new ApiError('The API returned an invalid response.', { uncertain: isWrite })
    throw new ApiError('Unable to reach the API. Check your network connection and API configuration.', { uncertain: isWrite })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
