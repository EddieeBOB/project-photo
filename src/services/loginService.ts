import { account } from "../lib/appwrite";

export async function handleLogin(email: string, password: string) {
    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (error: any) {
        console.error("Login failed:", error);
        alert(error.message || "Login failed");
        throw error;
    }
}