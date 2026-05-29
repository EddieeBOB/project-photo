import { account, ID, tablesDB } from "../lib/appwrite";

export async function handleSignUp(name: string, email: string, password: string) {

    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    try {
        const userId = ID.unique();
        await account.create({ userId, email, password, name });
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        await tablesDB.createRow({
            databaseId,
            tableId: 'users',
            rowId: userId,
            data: {
                email,
                firstName,
                lastName
            }
        });
        await account.createEmailPasswordSession({ email, password });
    } catch (error: any) {
        console.error("Sign up failed:", error);
        alert(error.message || "Sign up failed");
        throw error;
    }
}