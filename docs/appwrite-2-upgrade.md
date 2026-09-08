# Appwrite 2.0 integration

Frame uses Web SDK `appwrite` **27.0.0** and Server SDK `node-appwrite`
**29.0.0**. Both target the Appwrite 2.0 response format. The root package and
both independent function packages pin their versions and include lockfiles.

The browser already used `TablesDB`. Both functions now use it too:

| Function | Updated calls | Dynamic API key scopes |
| --- | --- | --- |
| `register-photo` | `createRow`, `getRow`, `updateRow`; named Storage parameters | `files.read`, `rows.read`, `rows.write` |
| `login-resolver` | `listRows` and the `rows` response; named Users/Account parameters | `rows.read`, `users.read`, `sessions.write` |

Database and table IDs, registry hashes, row/file permissions, and function
request/response bodies are unchanged. The registry still hashes stored bytes,
preserves the original row on duplicate registration, and updates only permissions
when gallery visibility changes. The `main.js` / `registry.js` split is retained.

## Deployment

1. Use Appwrite Cloud with 2.0 available, or upgrade a self-hosted instance to 2.0
   using the [official upgrade guide](https://appwrite.io/docs/advanced/self-hosting/update).
   Updating npm packages does not upgrade a self-hosted server.
2. Update each function's dynamic key scopes to the table above. The previous
   function code used `documents.read` / `documents.write`; the new row routes
   require `rows.read` / `rows.write`.
3. Redeploy both functions with `npm ci` as the dependency installation command,
   then rebuild and deploy the website. Keep the existing function IDs and
   environment variables.
4. Check username login, private photo publishing, verification, visibility
   changes, and deletion against the deployed project.

This code update does not deploy services or change live Appwrite settings.
It does not switch database engines or introduce S3, social sign-in, custom
domains, or firewall rules. Appwrite's [2.0 announcement](https://appwrite.io/blog/post/announcing-appwrite-2)
states that existing projects continue working without a data migration.

## Local checks

```sh
npm test
npm test --prefix functions/register-photo
npm test --prefix functions/login-resolver
npm run build
npm run lint
```

The function tests replace SDK HTTP calls or service methods and run offline.
Live integration and E2E suites can create resources and send email.

References: [Node SDK 29 release](https://github.com/appwrite/sdk-for-node/releases/tag/29.0.0),
[TablesDB API](https://appwrite.io/docs/references/cloud/server-nodejs/tablesDB).
