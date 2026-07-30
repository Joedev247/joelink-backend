import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataStore, verifyPassword } from './store.js';

test('createProduct preserves credentials for later retrieval', async () => {
  const store = await createDataStore();

  const created = await store.createProduct({
    name: 'Test Product',
    price: 25,
    credentials: {
      username: 'demo-user',
      password: 'demo-pass',
      email: 'demo@example.com',
      recoveryEmail: 'recovery@example.com',
      notes: 'Delivered instantly',
    },
  });

  const saved = (await store.listProducts()).find((product) => product.id === created.id);

  assert.deepEqual(saved?.credentials, {
    username: 'demo-user',
    password: 'demo-pass',
    email: 'demo@example.com',
    recoveryEmail: 'recovery@example.com',
    notes: 'Delivered instantly',
  });
});

test('createProduct uses a numeric-like id for frontend routes', async () => {
  const store = await createDataStore();

  const created = await store.createProduct({ name: 'Route Test' });

  assert.match(created.id, /^\d+$/);
});

test('verifyPassword accepts legacy plaintext passwords', async () => {
  assert.equal(await verifyPassword('plain-password', 'plain-password'), true);
  assert.equal(await verifyPassword('wrong-password', 'plain-password'), false);
});
