import * as React from 'react';
import { account, tablesDB } from '../lib/appwrite';
import type { Models } from 'appwrite';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    profile: any | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({ user: null, profile: null, loading: true, checkAuth: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = React.useState<Models.User<Models.Preferences> | null>(null);
    const [profile, setProfile] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(true);

    const checkAuth = React.useCallback(async () => {
        try {
            const res = await account.get();
            setUser(res);

            try {
                const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
                const profileDoc = await tablesDB.getRow({
                    databaseId,
                    tableId: 'users',
                    rowId: res.$id
                });
                setProfile(profileDoc);
            } catch (err) {
                console.error("Failed to load user profile document:", err);
                setProfile(null);
            }
        } catch (error) {
            setUser(null);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => React.useContext(AuthContext);
