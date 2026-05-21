import { account } from "../lib/appwrite";

export async function handleLogin(email, password, navigate) {
    try {
        await account.createEmailPasswordSession(email, password);
        navigate('/');
    } catch (error) {
        console.error("Login failed:", error);
        alert(error.message);
    }
}