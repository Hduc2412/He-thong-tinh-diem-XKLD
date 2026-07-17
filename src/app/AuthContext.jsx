import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

function mapRole(role) {
  return role === "SUPER_ADMIN" ? "Admin" : "CTV";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [customerItems, setCustomerItems] = useState([]);
  const [pointItems, setPointItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loadError, setLoadError] = useState("");

  const role = session?.user ? mapRole(session.user.role) : "Admin";

  useEffect(() => {
    api
      .me()
      .then((response) => setSession({ user: response.user }))
      .catch(() => setSession(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    setLoadError("");
    const ordersRequest = role === "Admin" ? api.adminOrders({ limit: 10 }) : api.orders({ limit: 10 });

    Promise.all([api.balances(), api.ledger({ limit: 10 }), ordersRequest])
      .then(([balancesResponse, ledgerResponse, ordersResponse]) => {
        setDashboardData({
          totalPoints: (balancesResponse.f || 0) + (balancesResponse.g || 0),
          fPoints: balancesResponse.f || 0,
          gPoints: balancesResponse.g || 0,
          redemptionUnlocked: balancesResponse.redemptionUnlocked,
          customerCount: ordersResponse.total || 0,
          ctvCount: role === "Admin" ? ordersResponse.total || 0 : 1,
        });
        setPointItems(ledgerResponse.entries || []);
        setOrderItems(ordersResponse.orders || []);
      })
      .catch((error) => setLoadError(error.message));
  }, [session, role]);

  const login = (nextSession) => {
    setSession(nextSession);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setSession(null);
    setDashboardData(null);
    setCustomerItems([]);
    setPointItems([]);
    setOrderItems([]);
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user,
      role,
      checkingSession,
      dashboardData,
      customerItems,
      pointItems,
      orderItems,
      loadError,
      login,
      logout,
    }),
    [session, role, checkingSession, dashboardData, customerItems, pointItems, orderItems, loadError]
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
