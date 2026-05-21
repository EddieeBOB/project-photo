import { account, ID } from "../lib/appwrite";

export async function handleSignUp(name, email, password, navigate) {
    try {
        await account.create(ID.unique(), email, password, name);
        await account.createEmailPasswordSession(email, password);
        navigate('/');
    } catch (error) {
        console.error("Sign up failed:", error);
        alert(error.message);
    }
}