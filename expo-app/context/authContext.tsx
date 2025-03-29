import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { User } from "@supabase/supabase-js"; // Import types


type AuthContextType = {
  user: User | null;
  setUser: Function
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            setUser(session?.user);
          router.replace("/(tabs)");
        }
      });
  
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            setUser(session?.user);
          router.replace("/(tabs)");
        } else {
            setUser(null);
          router.replace("/(auth)/login");
        }
      });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

    const contextValue: AuthContextType = {
        user,
        setUser
    }

  return (
    <AuthContext.Provider value={ contextValue }>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
