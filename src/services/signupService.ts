import { account, ID, tablesDB } from "../lib/appwrite";

export async function handleSignUp(name: string, email: string, password: string) {
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    const userId = ID.unique();

    // Step 1: Create the Appwrite Auth account
    try {
        await account.create({ userId, email, password, name });
    } catch (error: any) {
        console.error("Account creation failed:", error);
        // Surface a user-friendly message based on common Appwrite error types
        if (error?.code === 409 || error?.type === 'user_already_exists') {
            throw new Error("An account with this email already exists. Please log in.");
        }
        throw new Error("Failed to create account. Please try again.");
    }

    // Step 2: Create a session immediately so subsequent API calls are authenticated
    // and so that we have a session to clean up if step 3 fails
    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (sessionError: any) {
        console.error("Session creation after signup failed:", sessionError);
        // Account exists but we can't log in — user can try logging in manually
        throw new Error("Account created, but auto-login failed. Please log in manually.");
    }

    // Step 3: Create the user document in the database
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
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
    } catch (dbError: any) {
        console.error("User document creation failed:", dbError);

        // Retry once — transient network issues are common
        try {
            await tablesDB.createRow({
                databaseId,
                tableId: 'users',
                rowId: userId,
                data: { email, firstName, lastName }
            });
        } catch (retryError: any) {
            // CRITICAL: Auth account exists but user document doesn't.
            // Log for manual cleanup. Delete the session so the UI doesn't
            // think signup succeeded.
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