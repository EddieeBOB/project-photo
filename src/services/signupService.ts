import { account, ID, tablesDB } from "../lib/appwrite";

export async function handleSignUp(username: string, email: string, password: string) {
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    const userId = ID.unique();

    // Step 1: Create the Appwrite Auth account
    try {
        await account.create({ userId, email, password, name: username });
    } catch (error: any) {
        console.error("Account creation failed:", error);
        // Surface a user-friendly message based on common Appwrite error types
        if (error?.code === 409 || error?.type === 'user_already_exists') {
            throw new Error("An account with this email already exists. Please log in.");
        }
        throw new Error("Failed to create account. Please try again.");
    }

    // Step 2: Create a session immediately so subsequent API calls are authenticated
    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (sessionError: any) {
        console.error("Session creation after signup failed:", sessionError);
        throw new Error("Account created, but auto-login failed. Please log in manually.");
    }

    // Step 3: Create the user document in the database
    try {
        await tablesDB.createRow({
            databaseId,
            tableId: 'users',
            rowId: userId,
            data: {
                email,
                username
            }
        });
    } catch (dbError: any) {
        console.error("User document creation failed:", dbError);

        // Retry once because transient network issues are common
        try {
            await tablesDB.createRow({
                databaseId,
                tableId: 'users',
                rowId: userId,
                data: { email, username }
            });
        } catch (retryError: any) {
            console.error(
                `ORPHANED ACCOUNT DETECTED: userId=${userId}, email=${email}. ` +
                `Auth account exists but user document creation failed after retry. ` +
                `Manual cleanup required in Appwrite Console.`,
                retryError
            );
            try {
                await account.deleteSession('current');
            } catch { /* best effort */ }
            throw new Error("Account setup failed. Please contact support or try again later.");
        }
    }
}