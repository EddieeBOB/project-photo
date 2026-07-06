import * as React from 'react';
import { account, tablesDB } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { isAutoLoginAllowed, clearRememberPreference } from '../services/authService';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    profile: Models.Row | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context shared with the useAuth hook below
export const AuthContext = React.createContext<AuthContextType>({ user: null, profile: null, loading: true, checkAuth: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = React.useState<Models.User<Models.Preferences> | null>(null);
    const [profile, setProfile] = React.useState<Models.Row | null>(null);
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
        } catch {
            setUser(null);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        // Intentional: resolve the persisted session once on mount. This syncs
        // React with an external system (the Appwrite session), which is a valid
        // effect use despite the setState calls inside checkAuth.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkAuth();
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export const useAuth = () => React.useContext(AuthContext);
