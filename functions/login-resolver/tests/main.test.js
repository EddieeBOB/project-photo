import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, Query } from 'node-appwrite';

import handler from '../src/main.js';

// Exercise the real SDK methods, replacing only the HTTP transport.
async function invoke(t, respond, body = { username: 'Alice', password: 'test-password' }) {
  const env = { ...process.env };
  Object.assign(process.env, {
    APPWRITE_FUNCTION_API_ENDPOINT: 'https://appwrite.test/v1',
    APPWRITE_FUNCTION_PROJECT_ID: 'project',
    APPWRITE_DATABASE_ID: 'db',
    APPWRITE_USERS_TABLE_ID: 'users',
  });

  const calls = [];
  t.mock.method(Client.prototype, 'call', async function (method, url, _headers, data) {
    const call = { method, path: url.pathname, data, session: this.config.session };
    calls.push(call);
    return respond(call);
  });

  try {
    const sent = await handler({
      req: { headers: { 'x-appwrite-key': 'test-key' }, bodyJson: body },
      res: { json: (body, status = 200) => ({ body, status }) },
      error: () => {},
    });
    return { sent, calls };
  } finally {
    process.env = env;
  }
}

function success({ path }) {
  switch (path) {
    case '/v1/tablesdb/db/tables/users/rows':
      return { total: 1, rows: [{ $id: 'owner', username: 'Alice' }] };
    case '/v1/users/owner':
      return { email: 'alice@example.test' };
    case '/v1/account/sessions/email':
      return { secret: 'temporary-session' };
    case '/v1/account/sessions/current':
      return {};
    default:
      assert.fail(`Unexpected SDK request: ${path}`);
  }
}

test('resolves a TablesDB row and verifies the password before returning the email', async (t) => {
  const { sent, calls } = await invoke(t, success);

  assert.deepEqual(sent, { status: 200, body: { email: 'alice@example.test' } });
  assert.deepEqual(calls.map(({ method, path }) => [method, path]), [
    ['get', '/v1/tablesdb/db/tables/users/rows'],
    ['get', '/v1/users/owner'],
    ['post', '/v1/account/sessions/email'],
    ['delete', '/v1/account/sessions/current'],
  ]);
  assert.deepEqual(calls[0].data.queries, [Query.equal('username', 'Alice'), Query.limit(1)]);
  assert.deepEqual(calls[2].data, { email: 'alice@example.test', password: 'test-password' });
  assert.equal(calls[3].session, 'temporary-session');
});

test('reads rows from the case-insensitive fallback query', async (t) => {
  let lookups = 0;
  const { sent, calls } = await invoke(t, (call) => {
    if (call.path.endsWith('/rows')) {
      lookups++;
      return lookups === 1
        ? { total: 0, rows: [] }
        : { total: 1, rows: [{ $id: 'owner', username: ' ALICE ' }] };
    }
    return success(call);
  });

  assert.equal(sent.status, 200);
  assert.equal(lookups, 2);
  assert.deepEqual(calls[1].data.queries, [Query.limit(100)]);
});

test('an unknown username and a wrong password return the same refusal', async (t) => {
  const unknown = await invoke(t, () => ({ total: 0, rows: [] }));
  const wrongPassword = await invoke(t, (call) => {
    if (call.path.endsWith('/sessions/email')) throw new Error('Invalid credentials');
    return success(call);
  });

  assert.deepEqual(unknown.sent, {
    status: 401, body: { error: 'Invalid username or password.' },
  });
  assert.deepEqual(wrongPassword.sent, unknown.sent);
  assert.ok(unknown.calls.every(({ path }) => path.endsWith('/rows')));
  assert.equal(wrongPassword.calls.length, 3);
});

test('a database failure returns a safe error without attempting a session', async (t) => {
  const { sent, calls } = await invoke(t, () => { throw new Error('backend unavailable'); });

  assert.deepEqual(sent, {
    status: 500, body: { error: 'Login failed. Please try again later.' },
  });
  assert.equal(calls.length, 1);
});

test('temporary session cleanup failure does not reject a verified password', async (t) => {
  const { sent } = await invoke(t, (call) => {
    if (call.method === 'delete') throw new Error('cleanup unavailable');
    return success(call);
  });

  assert.deepEqual(sent, { status: 200, body: { email: 'alice@example.test' } });
});

test('missing credentials are rejected before any SDK request', async (t) => {
  const { sent, calls } = await invoke(t, success, { username: 'Alice' });
  assert.equal(sent.status, 400);
  assert.equal(calls.length, 0);
});
