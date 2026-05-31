import { account, tablesDB } from "../lib/appwrite";
import { Query } from "appwrite";

export async function handleLogin(username: string, password: string) {
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    let email = username;

    // Resolve username to email if the input is not an email format
    if (!username.includes('@')) {
        try {
            const response = await tablesDB.listRows({
                databaseId,
                tableId: 'users',
                queries: [
                    Query.equal('username', username),
                    Query.limit(1)
                ]
            });
            if (!response.rows || response.rows.length === 0) {
                throw new Error("Invalid username or password.");
            }
            email = response.rows[0].email;
        } catch (error: any) {
            if (error.message === "Invalid username or password.") {
                throw error;
            }
            console.error("Failed to resolve email from username:", error);
            throw new Error("Invalid username or password.");
        }
    }

    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (error: any) {
        console.error("Login failed:", error);
        const code = error?.code ?? error?.type;
        if (code === 401 || error?.type === 'user_invalid_credentials') {
            throw new Error("Invalid username or password.");
        }
        throw new Error("Login failed. Please try again later.");
    }
}