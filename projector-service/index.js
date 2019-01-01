'use strict'

const { MongoClient } = require('mongodb')
const to = require('flush-write-stream')

if (require.main === module) {
  const client = new MongoClient(process.env.MONGODB_URL, { useNewUrlParser: true })
  client.connect(function onConnect (err, client) {
    if (err) throw err
    startWatch(client.db('command-service-test'))
  })
}

async function startWatch (db) {
  console.log('Start watching...')
  const singleViewCollection = db.collection('singleView')

  const userCollection = db.collection('users')
  const todosCollection = db.collection('todos')
  const tasksCollection = db.collection('tasks')

  const userChangeStream = userCollection.watch({}).stream()
  userChangeStream.pipe(updateUserInfoWritableStream(singleViewCollection))

  const dotosChangeStream = todosCollection.watch({}).stream()
  dotosChangeStream.pipe(updateTodosWritableStream(singleViewCollection))

  const tasksChangeStream = tasksCollection.watch({ fullDocument: 'updateLookup' }).stream()
  tasksChangeStream.pipe(updateTasksWritableStream(singleViewCollection))
}

function updateTasksWritableStream (singleViewCollection) {
  return to.obj(function (chunk, enc, callback) {
    console.log('updateTasksWritableStream', chunk)
    if (chunk.operationType === 'insert') {
      const {
        user, todoId, text, done, _id: taskId
      } = chunk.fullDocument
      const userId = user._id
      singleViewCollection.findOneAndUpdate({
        userId: userId,
        'todos.todoId': todoId
      }, {
        $push: {
          'todos.$[todo].tasks': {
            taskId: taskId,
            text: text,
            done: done
          }
        }
      }, {
        arrayFilters: [
          { 'todo.todoId': { $eq: todoId } }
        ]
      }, callback)
      return
    }
    if (chunk.operationType === 'update') {
      console.log(chunk)
      const {
        user, todoId, text, done, _id: taskId
      } = chunk.fullDocument
      const userId = user._id
      singleViewCollection.findOneAndUpdate({
        userId: userId,
        'todos.todoId': todoId,
        'todos.tasks.taskId': taskId
      }, {
        $set: {
          'todos.$[todo].tasks.$[task].text': text,
          'todos.$[todo].tasks.$[task].done': done
        }
      }, {
        arrayFilters: [
          { 'todo.todoId': { $eq: todoId } },
          { 'task.taskId': { $eq: taskId } }
        ]
      }, callback)
      return
    }

    callback()
  })
}

function updateTodosWritableStream (singleViewCollection) {
  return to.obj(function (chunk, enc, callback) {
    console.log('updateTodosWritableStream', chunk)
    // no command update todos (for now!)
    if (chunk.operationType !== 'insert') return callback()

    const { user, _id: todoId, name, color } = chunk.fullDocument
    const userId = user._id
    singleViewCollection.findOneAndUpdate({
      userId: userId
    }, {
      $push: {
        todos: {
          todoId: todoId,
          name: name,
          color: color,
          tasks: [],
          createdAt: new Date()
        }
      }
    }, callback)
  })
}

function updateUserInfoWritableStream (singleViewCollection) {
  return to.obj(function (chunk, enc, callback) {
    console.log('updateUserInfoWritableStream', chunk)
    // no command update user infos (for now!)
    if (chunk.operationType !== 'insert') return callback()

    const { _id: userId, username } = chunk.fullDocument
    singleViewCollection.findOneAndUpdate({
      userId: userId
    }, {
      $setOnInsert: {
        username,
        todos: [],
        createdAt: new Date()
      }
    }, { upsert: true }, callback)
  })
}

module.exports = startWatch
