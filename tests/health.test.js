const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../server');

test('GET /api/health returns 200', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Server is healthy');
});

test('Unknown API route returns 404', async () => {
  const response = await request(app).get('/api/unknown');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
});
