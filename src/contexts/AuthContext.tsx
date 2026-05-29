import * as React from 'react';
import { account } from '../lib/appwrite';
import type { Models } from 'appwrite';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    loading: boolean;
}

export const AuthContext = React.createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = React.useState<Models.User<Models.Preferences> | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await account.get();
                setUser(res);
            } catch (error) {
                // User is not logged in, catch the error silently
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => React.useContext(AuthContext);
