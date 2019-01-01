'use strict'

const t = require('tap')
const Fastify = require('fastify')
const fp = require('fastify-plugin')
const commandSerice = require('./index')

t.test('command service', async t => {
  const fastify = Fastify({ logger: { level: 'silent' } })
  fastify.register(fp(commandSerice), { MONGODB_URL: 'mongodb://localhost/command-service-test' })

  t.tearDown(() => fastify.close())

  await fastify.ready()

  try { await fastify.mongo.db.collection('users').drop() } catch (e) {}
  try { await fastify.mongo.db.collection('todos').drop() } catch (e) {}
  try { await fastify.mongo.db.collection('tasks').drop() } catch (e) {}

  const registerResponse = await fastify.inject({
    method: 'POST',
    url: '/register',
    payload: {
      username: 'my-username'
    }
  })
  t.strictSame(registerResponse.statusCode, 200)

  const createTodoListResponse = await fastify.inject({
    method: 'POST',
    url: '/create-todo-list',
    headers: {
      username: 'my-username'
    },
    payload: {
      name: 'my todo list',
      color: 'red'
    }
  })
  t.strictSame(createTodoListResponse.statusCode, 200)

  const todoId = JSON.parse(createTodoListResponse.payload)

  const addTaskResponse = await fastify.inject({
    method: 'POST',
    url: '/add-task',
    headers: {
      username: 'my-username'
    },
    payload: {
      todoId: todoId,
      text: 'my text'
    }
  })
  t.strictSame(addTaskResponse.statusCode, 200)

  const taskId = JSON.parse(addTaskResponse.payload)

  const setTaskToDoneResponse = await fastify.inject({
    method: 'POST',
    url: '/set-task-done',
    headers: {
      username: 'my-username'
    },
    payload: {
      taskId: taskId,
      done: true
    }
  })
  t.strictSame(setTaskToDoneResponse.statusCode, 200)

  const setTaskToUndoneResponse = await fastify.inject({
    method: 'POST',
    url: '/set-task-done',
    headers: {
      username: 'my-username'
    },
    payload: {
      taskId: taskId,
      done: false
    }
  })
  t.strictSame(setTaskToUndoneResponse.statusCode, 200)

  const changeTaskTestResponse = await fastify.inject({
    method: 'POST',
    url: '/set-task-text',
    headers: {
      username: 'my-username'
    },
    payload: {
      taskId: taskId,
      text: 'new-text!'
    }
  })
  t.strictSame(changeTaskTestResponse.statusCode, 200)

  const todos = await fastify.mongo.db.collection('todos').find({}).toArray()

  t.strictSame(todos.length, 1)
  t.strictSame(todos[0].user.username, 'my-username')
  t.ok(todos[0].user._id)
  t.strictSame(todos[0].name, 'my todo list')
  t.strictSame(todos[0].color, 'red')

  const tasks = await fastify.mongo.db.collection('tasks').find({}).toArray()

  t.strictSame(tasks.length, 1)
  t.strictSame(tasks[0].user.username, 'my-username')
  t.ok(tasks[0].user._id)
  t.strictSame(tasks[0].text, 'new-text!')
  t.strictSame(tasks[0].done, false)

  t.end()
})
