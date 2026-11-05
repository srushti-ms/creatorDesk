const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://creatordesk-production-283d.up.railway.app').replace(/\/$/, '')

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
  } catch {
    throw new Error('Could not reach CreatorDesk. Check your connection and API URL.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })
export const api = {
  health: () => request('/api/health'),
  radar: () => request('/api/dashboard/rights-radar'),
  brands: () => request('/api/brands'),
  createBrand: (body) => request('/api/brands', json('POST', body)),
  collaborations: () => request('/api/collaborations'),
  createCollaboration: (body) => request('/api/collaborations', json('POST', body)),
  rights: () => request('/api/rights'),
  createRight: (body) => request('/api/rights', json('POST', body)),
  updateRight: (id, body) => request(`/api/rights/${id}`, json('PUT', body)),
  deleteRight: (id) => request(`/api/rights/${id}`, { method: 'DELETE' }),
  exclusivity: () => request('/api/exclusivity'),
  createExclusivity: (body) => request('/api/exclusivity', json('POST', body)),
  deleteExclusivity: (id) => request(`/api/exclusivity/${id}`, { method: 'DELETE' }),
}
export { API_BASE }
