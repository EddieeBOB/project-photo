import { account } from "../lib/appwrite";

export async function handleLogin(email: string, password: string) {
    try {
        await account.createEmailPasswordSession({ email, password });
    } catch (error: any) {
        console.error("Login failed:", error);
        const code = error?.code ?? error?.type;
        if (code === 401 || error?.type === 'user_invalid_credentials') {
            throw new Error("Invalid email or password.");
        }
        throw new Error("Login failed. Please try again later.");
    }
}