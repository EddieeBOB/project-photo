//TODO: Authentication

import { account } from "../lib/appwrite";

export async function handleLogin(email: string, password: string, navigate: (path: string) => void) {
    try {
        await account.createEmailPasswordSession(email, password);
        navigate('/');
    } catch (error: any) {
        console.error("Login failed:", error);
        alert(error.message || "Login failed");
    }
}