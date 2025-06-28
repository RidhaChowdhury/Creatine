import React, { createContext, useState } from 'react';

export type RefreshContextType = {
    refreshTrigger: {
        creatine: number;
        water: number;
    };
    refresh: (type: 'creatine' | 'water') => void;
    nuclearRefresh: () => void; // For when you want to update EVERYTHING
};

export const RefreshContext = createContext<RefreshContextType>({
    refreshTrigger: { creatine: 0, water: 0 },
    refresh: () => {},
    nuclearRefresh: () => {},
});

export const RefreshProvider = ({ children }: { children: React.ReactNode }) => {
    const [refreshTrigger, setTrigger] = useState({
        creatine: 0,
        water: 0,
    });

    // Targeted refresh
    const refresh = (type: 'creatine' | 'water') => {
        setTrigger((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    };

    // Nuclear option
    const nuclearRefresh = () => {
        setTrigger((prev) => ({
            creatine: prev.creatine + 1,
            water: prev.water + 1,
        }));
    };

    return (
        <RefreshContext.Provider value={{ refreshTrigger, refresh, nuclearRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
};
