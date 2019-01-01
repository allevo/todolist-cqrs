'use strict'

const fp = require('fastify-plugin')

async function registerDatabase (fastify) {
  fastify.register(require('fastify-mongodb'), { url: fastify.config.MONGODB_URL })
}

async function registerBL (fastify) {
  const ObjectId = fastify.mongo.ObjectId

  const userCollection = fastify.mongo.db.collection('users')
  fastify.decorate('userController', {
    register: async username => {
      const writeResult = await userCollection.insertOne({
        username,
        createdAt: new Date()
      })
      return writeResult.insertedId
    },
    getUserByUsername: async username => {
      const user = await userCollection.findOne({ username })
      fastify.assert.ok(user, 400, 'Unable to find username: ' + username)
      return user
    }
  })

  const todoCollection = fastify.mongo.db.collection('todos')
  fastify.decorate('todoController', {
    createTodoList: async (user, name, color) => {
      const writeResult = await todoCollection.insertOne({
        user, name, color
      })
      return writeResult.insertedId
    }
  })

  const taskCollection = fastify.mongo.db.collection('tasks')
  fastify.decorate('taskController', {
    addTask: async (user, todoId, text) => {
      const writeResult = await taskCollection.insertOne({
        user, todoId: new ObjectId(todoId), text, done: false
      })
      return writeResult.insertedId
    },
    setTaskDone: async (user, taskId, done) => {
      const writeResult = await taskCollection.findOneAndUpdate(
        { _id: new ObjectId(taskId) },
        { $set: { done: Boolean(done) } },
        { returnOriginal: false }
      )
      return writeResult.value
    },
    setTaskText: async (user, taskId, text) => {
      const writeResult = await taskCollection.findOneAndUpdate(
        { _id: new ObjectId(taskId) },
        { $set: { text } },
        { returnOriginal: false }
      )
      return writeResult.value
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
    .post('/register', { schema: registerSchema }, async function (request, reply) {
      return this.userController.register(request.body.username)
    })
    .addHook('preHandler', async function (request, reply) {
      // TODO: make a plugin for this!
      if (request.raw.url !== '/register') {
        const username = request.headers['username']
        request.user = await this.userController.getUserByUsername(username)
      }
    })
    .post('/create-todo-list', { schema: createTodoListSchema }, async function (request, reply) {
      return this.todoController.createTodoList(request.user, request.body.name, request.body.color)
    })
    .post('/add-task', { schema: addTaskSchema }, async function (request, reply) {
      return this.taskController.addTask(request.user, request.body.todoId, request.body.text)
    })
    .post('/set-task-done', { schema: setTaskDoneSchema }, async function (request, reply) {
      return this.taskController.setTaskDone(request.user, request.body.taskId, request.body.done)
    })
    .post('/set-task-text', { schema: setTaskTextSchema }, async function (request, reply) {
      return this.taskController.setTaskText(request.user, request.body.taskId, request.body.text)
    })
}

const registerSchema = {
  body: {
    type: 'object',
    required: ['username'],
    properties: {
      username: { type: 'string' }
    }
  }
}

const createTodoListSchema = {
  body: {
    type: 'object',
    required: ['name', 'color'],
    properties: {
      name: { type: 'string' },
      color: { type: 'string' }
    }
  }
}
const addTaskSchema = {
  body: {
    type: 'object',
    required: ['todoId', 'text'],
    properties: {
      todoId: { type: 'string' },
      text: { type: 'string' }
    }
  }
}
const setTaskDoneSchema = {
  body: {
    type: 'object',
    required: ['taskId', 'done'],
    properties: {
      taskId: { type: 'string' },
      done: { type: 'boolean' }
    }
  }
}
const setTaskTextSchema = {
  body: {
    type: 'object',
    required: ['taskId', 'text'],
    properties: {
      taskId: { type: 'string' },
      text: { type: 'string' }
    }
  }
}
