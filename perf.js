import { objectQueryBuilder } from './index.js'
const f = objectQueryBuilder({
  age: '$.body.age',
  name: '$.body.name',
  location: ['$.body.latitude', '$.body.longitude'],
  id: '$.params.id',
  friends: '$.body."friends list".[?(@.id === 5)].name'
})
const body = {
  body: {
    age: 23,
    name: 'Jesse Mitchell',
    latitude: 20.0,
    longitude: 30.0,
    'friends list': [{
      id: 5,
      age: 17,
      name: 'Kevin'
    }, {
      id: 8
    }, {
      id: 12
    }, {
      id: 111
    }]
  },
  params: {
    id: 17
  }
}
console.time('Test')
for (let i = 0; i < 1e6; i++) {
  f(body, { id: 5 })
}
console.log(f(body, { id: 5 }))
console.timeEnd('Test')
