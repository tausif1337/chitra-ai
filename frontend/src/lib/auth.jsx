/**
 * Session state for the whole app.
 *
 * On mount it asks the API to restore a session from the refresh cookie. Until
 * that answers, status is "loading" and protected routes render nothing --
 * without this, a reload would flash the sign-in screen at an already
 * signed-in user.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, setAccessToken, setSessionEndedHandler } from "./api";

// status is one of "loading" | "authenticated" | "anonymous".
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [status, setStatus] = useState("loading");

  const endSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    // The client calls this when a refresh fails mid-request.
    setSessionEndedHandler(endSession);
    return () => setSessionEndedHandler(null);
  }, [endSession]);

  useEffect(() => {
    let cancelled = false;
    api
      .restoreSession()
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setUserState(result.user);
          setStatus("authenticated");
        } else {
          setStatus("anonymous");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.login({ email, password });
    setAccessToken(result.access);
    setUserState(result.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (input) => {
    const result = await api.register(input);
    setAccessToken(result.access);
    setUserState(result.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      login,
      register,
      logout,
      setUser: setUserState,
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
