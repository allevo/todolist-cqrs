'use strict'

const childProcess = require('child_process')
const { MongoClient } = require('mongodb')
const path = require('path')
const t = require('tap')
const sget = require('simple-get')

function startProcess (cwd, port) {
  const child = childProcess.spawn('npm', ['start', '--', '--log-level', 'trace', '--port', port + ''], {
    cwd: cwd,
    env: {
      MONGODB_URL: 'mongodb://localhost:27017,localhost:27018/command-service-test?replicaSet=rs0',
      ...process.env
    }
  })

  child.on('exit', (code, signal) => {
    console.log('exit', code, signal)
  })

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  return child
}

function wait (sec) {
  return new Promise(resolve => setTimeout(resolve, sec * 1000))
}

function makeRequest (opts) {
  return new Promise((resolve, reject) => {
    sget.concat(opts, function (err, response, body) {
      if (err) return reject(err)
      response.body = body
      resolve(response)
    })
  })
}

t.test('aa', async t => {
  const client = await MongoClient.connect('mongodb://localhost:27017,localhost:27018/command-service-test?replicaSet=rs0', { useNewUrlParser: true })
  await client.db('command-service-test').dropDatabase()
  t.tearDown(async () => {
    await client.close(true)
  })

  const csChildProcess = startProcess(path.join(__dirname, '..', 'command-service'), 3000)
  const rsChildProcess = startProcess(path.join(__dirname, '..', 'reader-service'), 3001)
  const psChildProcess = startProcess(path.join(__dirname, '..', 'projector-service'))

  t.tearDown(() => {
    csChildProcess.kill()
    rsChildProcess.kill()
    psChildProcess.kill()
  })
  await wait(4)

  const registerResponse = await makeRequest({
    method: 'POST',
    url: 'http://localhost:3000/register',
    body: {
      username: 'my-username'
    },
    json: true
  })
  t.strictSame(registerResponse.statusCode, 200)

  const createTodoListResponse = await makeRequest({
    method: 'POST',
    url: 'http://localhost:3000/create-todo-list',
    headers: {
      username: 'my-username'
    },
    body: {
      name: 'my todo list',
      color: 'red'
    },
    json: true
  })
  t.strictSame(createTodoListResponse.statusCode, 200)

  const todoId = createTodoListResponse.body

  const addTaskResponse = await makeRequest({
    method: 'POST',
    url: 'http://localhost:3000/add-task',
    headers: {
      username: 'my-username'
    },
    body: {
      todoId: todoId,
      text: 'my text'
    },
    json: true
  })
  t.strictSame(addTaskResponse.statusCode, 200)

  const taskId = addTaskResponse.body

  const setTaskToDoneResponse = await makeRequest({
    method: 'POST',
    url: 'http://localhost:3000/set-task-done',
    headers: {
      username: 'my-username'
    },
    body: {
      todoId: todoId,
      taskId: taskId,
      done: true
    },
    json: true
  })
  t.strictSame(setTaskToDoneResponse.statusCode, 200)

  await wait(2)

  const getResponse = await makeRequest({
    method: 'GET',
    url: 'http://localhost:3001/get',
    headers: {
      username: 'my-username'
    },
    json: true
  })
  t.strictSame(getResponse.statusCode, 200)

  const singleView = getResponse.body

  t.ok(singleView._id)
  delete singleView._id
  t.ok(singleView.createdAt)
  delete singleView.createdAt
  t.ok(singleView.userId)
  delete singleView.userId

  t.ok(singleView.todos)
  t.ok(singleView.todos[0])
  t.ok(singleView.todos[0].todoId)
  delete singleView.todos[0].todoId
  t.ok(singleView.todos[0].createdAt)
  delete singleView.todos[0].createdAt

  t.ok(singleView.todos[0].tasks)
  t.ok(singleView.todos[0].tasks[0])
  t.ok(singleView.todos[0].tasks[0].taskId)
  delete singleView.todos[0].tasks[0].taskId

  t.strictSame(singleView, {
    username: 'my-username',
    todos: [
      {
        name: 'my todo list',
        color: 'red',
        tasks: [
          {
            text: 'my text',
            done: true
          }
        ]
      }
    ]
  })
})
