import { account, ID, tablesDB } from "../lib/appwrite";
import { ownerPermissions } from "../lib/permissions";
import { sendVerificationEmail } from "./authService";

export async function handleSignUp(username: string, email: string, password: string) {
    const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
    const userId = ID.unique();

    // Step 1: Create the Appwrite Auth account
    try {
        await account.create({ userId, email, password, name: username });
    } catch (error) {
        console.error("Account creation failed:", error);
        // Surface a user-friendly message based on common Appwrite error types
        const err = error as { code?: number; type?: string };
        if (err.code === 409 || err.type === 'user_already_exists') {
            throw new Error("An account with this email already exists. Please log in.", { cause: error });
        }
        throw new Error("Failed to create account. Please try again.", { cause: error });
    }

    // Step 2: Create a session immediately so subsequent API calls are authenticated
    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (sessionError) {
        console.error("Session creation after signup failed:", sessionError);
        throw new Error("Account created, but auto-login failed. Please log in manually.", { cause: sessionError });
    }

    // Step 3: Create the user document in the database
    try {
        await tablesDB.createRow({
            databaseId,
            tableId: 'users',
            rowId: userId,
            data: { username },
            permissions: ownerPermissions(userId, true)
        });
    } catch (dbError) {
        console.error("User document creation failed:", dbError);

        // Retry once because transient network issues are common
        try {
            await tablesDB.createRow({
                databaseId,
                tableId: 'users',
                rowId: userId,
                data: { username },
                permissions: ownerPermissions(userId, true)
            });
        } catch (retryError) {
            console.error(
                `ORPHANED ACCOUNT DETECTED: userId=${userId}. ` +
                `Auth account exists but user document creation failed after retry. ` +
                `Manual cleanup required in Appwrite Console.`,
                retryError
            );
            try {
                await account.deleteSession({ sessionId: 'current' });
            } catch { /* best effort */ }
            throw new Error("Account setup failed. Please contact support or try again later.", { cause: retryError });
        }
    }

    // Step 4: Send a verification email (best-effort — failure here must not
    // break signup; the user can resend from the account page).
    try {
        await sendVerificationEmail();
    } catch (verifyError) {
        console.warn("Failed to send verification email after signup:", verifyError);
    }
}