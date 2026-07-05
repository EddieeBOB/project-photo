import { Client, Account, Users, Databases, Query } from 'node-appwrite';

/**
 * login-resolver — lets users sign in with a *username* without ever exposing
 * the username→email mapping to anonymous clients.
 *
 * Why this exists:
 *   The `users` table is publicly readable by username (public profile pages
 *   look users up that way), so it deliberately does NOT store email anymore.
 *   But Appwrite has no "log in by username" API — `createEmailPasswordSession`
 *   needs the email. Resolving username→email in the browser would re-expose
 *   every user's email (anonymous enumeration — the exact leak we closed).
 *
 *   So we resolve it here, server-side, and only return the email AFTER the
 *   password is verified — i.e. only to the account's rightful owner, who
 *   already knows their own email. The browser then opens the real session
 *   itself via the normal email/password flow, so MFA and cookie persistence
 *   behave identically to an email login.
 *
 * Request  (POST, JSON): { "username": string, "password": string }
 * Response (JSON):
 *   200 { "email": string }                            password correct
 *   400 { "error": "..." }                             malformed request
 *   401 { "error": "Invalid username or password." }   unknown user OR wrong password
 *
 * Dynamic API key scopes (declared in appwrite.config.json):
 *   documents.read, users.read, sessions.write
 *
 * NOTE on abuse: password verification here uses the admin key, which bypasses
 * per-IP rate limits. Appwrite still rate-limits function executions, but if you
 * want stricter brute-force protection later, add a CAPTCHA or a per-username
 * attempt counter in front of step 3.
 */
export default async ({ req, res, log, error }) => {
  // ---- parse & validate input ------------------------------------------
  let username = '';
  let password = '';
  try {
    const body = req.bodyJson ?? (req.bodyRaw ? JSON.parse(req.bodyRaw) : {});
    username = String(body.username ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return res.json({ error: 'Invalid request body.' }, 400);
  }
  if (!username || !password) {
    return res.json({ error: 'Username and password are required.' }, 400);
  }

  // Uniform failure — never reveals whether the username exists.
  const reject = () => res.json({ error: 'Invalid username or password.' }, 401);

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey = req.headers['x-appwrite-key'] || '';
  // These are not secrets (the DB id ships in the web bundle); env overrides win.
  const databaseId = process.env.APPWRITE_DATABASE_ID || '6a0955e90024b114ad38';
  const usersTableId = process.env.APPWRITE_USERS_TABLE_ID || 'users';

  const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  const databases = new Databases(admin);
  const users = new Users(admin);

  // ---- 1. resolve username -> userId (row.$id === Auth userId) ---------
  let userId = null;
  try {
    const exact = await databases.listDocuments(databaseId, usersTableId, [
      Query.equal('username', username),
      Query.limit(1),
    ]);
    if (exact.total > 0) {
      userId = exact.documents[0].$id;
    } else {
      // Case/whitespace-insensitive fallback, mirroring the app's old logic.
      const target = username.toLowerCase();
      const scan = await databases.listDocuments(databaseId, usersTableId, [
        Query.limit(100),
      ]);
      const match = scan.documents.find(
        (d) => String(d.username || '').trim().toLowerCase() === target,
      );
      if (match) userId = match.$id;
    }
  } catch (e) {
    error(`username lookup failed: ${e.message}`);
    return res.json({ error: 'Login failed. Please try again later.' }, 500);
  }
  if (!userId) return reject();

  // ---- 2. userId -> email (from Auth; only returned after the pw check) -
  let email;
  try {
    email = (await users.get(userId)).email;
  } catch (e) {
    error(`user fetch failed for ${userId}: ${e.message}`);
    return reject();
  }
  if (!email) return reject();

  // ---- 3. verify the password by creating (then deleting) a session ----
  //   There's no standalone "verify password" endpoint, so we create a
  //   throwaway email/password session with the admin key: a wrong password
  //   throws, a correct one succeeds. We immediately delete it so it doesn't
  //   count against the user's session limit — the browser creates the real,
  //   MFA-aware session itself.
  let session;
  try {
    session = await new Account(admin).createEmailPasswordSession(email, password);
  } catch {
    return reject();
  }
  try {
    const sessionClient = new Client()
      .setEndpoint(endpoint)
      .setProject(project)
      .setSession(session.secret);
    await new Account(sessionClient).deleteSession('current');
  } catch (e) {
    // Non-fatal: an unreferenced session will expire on its own.
    error(`temp session cleanup failed: ${e.message}`);
  }

  // ---- 4. password verified: hand the owner their own email ------------
  return res.json({ email });
};
