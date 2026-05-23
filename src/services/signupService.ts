//TODO: Authentication

import { account, ID } from "../lib/appwrite";

export async function handleSignUp(name: string, email: string, password: string, navigate: (path: string) => void) {
    try {
        await account.create(ID.unique(), email, password, name);
        await account.createEmailPasswordSession(email, password);
        navigate('/');
    } catch (error: any) {
        console.error("Sign up failed:", error);
        alert(error.message || "Sign up failed");
    }
}