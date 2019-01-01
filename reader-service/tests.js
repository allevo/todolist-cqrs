'use strict'

const t = require('tap')
const Fastify = require('fastify')
const fp = require('fastify-plugin')
const commandSerice = require('./index')

t.test('command service', async t => {
  const fastify = Fastify({ logger: { level: 'trace' } })
  fastify.register(fp(commandSerice), { MONGODB_URL: 'mongodb://localhost/command-service-test' })

  t.tearDown(() => fastify.close())

  await fastify.ready()

  try { await fastify.mongo.db.collection('singleView').drop() } catch (e) {}

  fastify.mongo.db.collection('singleView').insertOne({
    username: 'my-username',
    todos: []
  })

  fastify.mongo.db.collection('users').insertOne({
    username: 'my-username'
  })

  const registerResponse = await fastify.inject({
    method: 'GET',
    url: '/get',
    headers: {
      username: 'my-username'
    }
  })
  t.strictSame(registerResponse.statusCode, 200)

  const singleView = JSON.parse(registerResponse.payload)
  t.ok(singleView._id)
  delete singleView._id
  t.strictSame(singleView, {
    username: 'my-username',
    todos: []
  })

  t.end()
})
