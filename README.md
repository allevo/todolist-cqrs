# Todo List CQRS
Todo List with CQRS

Change HOST_IP in `e2e-test/setup.sh`

```
cd e2e-test
./setup.sh
node tests.js
```

## Command Service
Implements commands writting the data into 3 mongodb collections

## Projector Service
Projects the mongodb changes into `singleView` collection

## Reader Service
Expose a single endpoint that returns all info

## E2E Test
General e2e test
- Drop databases
- Start 3 services
- Register user
- Add todo
- Add task to todo
- Set task to done
- Get singleView
