const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4100/api";

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Khong the ket noi may chu");
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
  dashboard(token) {
    return request("/dashboard", { token });
  },
  customers(token) {
    return request("/customers", { token });
  },
  points(token) {
    return request("/points", { token });
  },
};
