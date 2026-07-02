import * as React from 'react';
import { account, tablesDB } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { isAutoLoginAllowed, clearRememberPreference } from '../services/authService';

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

            // A persisted session exists, but only resume it if "remember me"
            // is still within its 30-day window (or we're in the same browser
            // session). Otherwise end the session and treat the user as logged out.
            if (!isAutoLoginAllowed()) {
                clearRememberPreference();
                try {
                    await account.deleteSession({ sessionId: 'current' });
                } catch {
                    /* session already gone */
                }
                setUser(null);
                setProfile(null);
                return;
            }

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
