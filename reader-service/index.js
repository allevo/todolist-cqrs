'use strict'

const fp = require('fastify-plugin')

async function registerDatabase (fastify) {
  fastify.register(require('fastify-mongodb'), { url: fastify.config.MONGODB_URL })
}

async function registerBL (fastify) {
  const userCollection = fastify.mongo.db.collection('users')
  fastify.decorate('userController', {
    getUserByUsername: async username => {
      const user = await userCollection.findOne({ username })
      fastify.assert.ok(user, 400, 'Unable to find username: ' + username)
      return user
    }
  })

  const singleViewCollection = fastify.mongo.db.collection('singleView')

  fastify.decorate('todoController', {
    getTodoLists: async user => {
      return singleViewCollection.findOne({ username: user.username })
    }
  })
}

module.exports = async function (fastify, opts) {
  fastify.register(require('fastify-env'), {
    schema: {
      type: 'object',
      required: ['MONGODB_URL'],
      properties: {
        MONGODB_URL: { type: 'string' }
      }
    },
    data: opts
  })
    .register(require('fastify-sensible'))
    .register(fp(registerDatabase))
    .register(fp(registerBL))
    .addHook('preHandler', async function (request, reply) {
      const username = request.headers['username']
      request.user = await this.userController.getUserByUsername(username)
    })
    .get('/get', async function (request, reply) {
      return this.todoController.getTodoLists(request.user)
    })
}
