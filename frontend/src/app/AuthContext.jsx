import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { customers as mockCustomers } from "@/data/mockData";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem("xkld-session");
    return stored ? JSON.parse(stored) : null;
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [customerItems, setCustomerItems] = useState(mockCustomers);
  const [pointItems, setPointItems] = useState([]);
  const [loadError, setLoadError] = useState("");

  const role = session?.user?.role || "Admin";

  useEffect(() => {
    if (!session?.token) return;

    setLoadError("");
    Promise.all([api.dashboard(session.token), api.customers(session.token), api.points(session.token)])
      .then(([dashboardResponse, customersResponse, pointsResponse]) => {
        setDashboardData(dashboardResponse.data);
        setCustomerItems(customersResponse.data);
        setPointItems(pointsResponse.data);
      })
      .catch((error) => setLoadError(error.message));
  }, [session]);

  const login = (nextSession) => {
    localStorage.setItem("xkld-session", JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const logout = () => {
    localStorage.removeItem("xkld-session");
    setSession(null);
    setDashboardData(null);
    setCustomerItems(mockCustomers);
    setPointItems([]);
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user,
      role,
      token: session?.token,
      dashboardData,
      customerItems,
      pointItems,
      loadError,
      login,
      logout,
    }),
    [session, role, dashboardData, customerItems, pointItems, loadError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
