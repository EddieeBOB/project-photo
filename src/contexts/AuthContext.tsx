import * as React from 'react';
import { account } from '../lib/appwrite';
import type { Models } from 'appwrite';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({ user: null, loading: true, checkAuth: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = React.useState<Models.User<Models.Preferences> | null>(null);
    const [loading, setLoading] = React.useState(true);

    const checkAuth = React.useCallback(async () => {
        try {
            const res = await account.get();
            setUser(res);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{ user, loading, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => React.useContext(AuthContext);
