const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Không thể kết nối máy chủ");
  }

  return data;
}

export const api = {
  login(credentials) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },
  logout() {
    return request("/auth/logout", {
      method: "POST",
    });
  },
  me() {
    return request("/auth/me");
  },
  balances() {
    return request("/points/balances");
  },
  ledger(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/points/ledger${query ? `?${query}` : ""}`);
  },
  orders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/orders${query ? `?${query}` : ""}`);
  },
  adminOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/orders${query ? `?${query}` : ""}`);
  },
  adminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ""}`);
  },
  banUser(id) {
    return request(`/admin/users/${id}/ban`, { method: "POST" });
  },
  unbanUser(id) {
    return request(`/admin/users/${id}/unban`, { method: "POST" });
  },
  approveOrder(id) {
    return request(`/admin/orders/${id}/approve`, {
      method: "POST",
    });
  },
  rejectOrder(id) {
    return request(`/admin/orders/${id}/reject`, {
      method: "POST",
    });
  },
};
