#!/usr/bin/env bash


# Change me!
HOST_IP=192.168.1.2

docker run --name primary --rm -p 0.0.0.0:27017:27017 -d mongo:4 --replSet rs0
docker run --name secondary --rm -p 0.0.0.0:27018:27017 -d mongo:4 --replSet rs0

cd /Users/allevo/mongodb-osx-x86_64-4.0.4

./bin/mongo << EOF

rs.initiate()
rs.add({ host: '$HOST_IP:27018', priority: 0, votes: 0 })

const c = rs.conf()
c.members[0].host='$HOST_IP:27017'
c.members[1].host='$HOST_IP:27018'
rs.reconfig(c)

rs.status()

EOF
