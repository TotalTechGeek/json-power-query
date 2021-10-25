import { queryBuilder, objectQueryBuilder, generatorBuilder } from './index.js'
const person = {
  age: 23,
  name: 'Jesse Mitchell',
  interests: ['programming', 'business'],
  'odd thing': 7,
  friends: [{
    name: 'Bob',
    age: 25
  }, {
    name: 'Kevin',
    age: 23
  }, {
    name: 'Steve',
    age: 32
  }, {
    name: 'Aaron',
    age: 17
  }]
}
describe('Query Builder Tests', () => {
  test('Simple pass-through ($)', () => {
    const f = queryBuilder('$')
    expect(f(person)).toStrictEqual(person)
  })
  test('Get a number property', () => {
    const f = queryBuilder('$.age')
    expect(f(person)).toBe(23)
  })
  test('Get a string property', () => {
    const f = queryBuilder('$.name')
    expect(f(person)).toBe('Jesse Mitchell')
  })
  test('Get an odd property', () => {
    const f = queryBuilder('$."odd thing"')
    expect(f(person)).toBe(7)
  })
  test('Get values from an array', () => {
    const f = queryBuilder('$.interests.*')
    expect(f(person)).toStrictEqual(['programming', 'business'])
  })
  test('Get property from an array', () => {
    const f = queryBuilder('$.interests.length')
    expect(f(person)).toBe(2)
  })
  test('Get value from an array index', () => {
    const f = queryBuilder('$.interests.1')
    expect(f(person)).toBe('business')
  })
  test('Try out filtering', () => {
    const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, 20] }.name')
    expect(f(person)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
  })
  test('Try out filtering w/ JSONPath Syntax', () => {
    const f = queryBuilder('$.friends.[?(@.age > 20)].name')
    expect(f(person)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
    const g = queryBuilder('$.friends.[?(@.name === "Aaron")].name')
    expect(g(person)).toStrictEqual(['Aaron'])
    const h = queryBuilder('$.friends.[?(@.name === \'Kevin\')].name')
    expect(h(person)).toStrictEqual(['Kevin'])
  })
  test('Try out filtering with context', () => {
    const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, { "context": "" }] }.name')
    expect(f(person, 20)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
  })
  test('Try out filtering with context w/ JSONPath Syntax', () => {
    const f = queryBuilder('$.friends.[?(@.age > $)].name')
    expect(f(person, 20)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
    const g = queryBuilder('$.friends.[?(@.age !== 17)].name')
    expect(g(person)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
  })
  test('Try out filtering on items in array with context', () => {
    const f = queryBuilder('$.interests.*{ ">": [{ "var": "" }, { "context": "" }] }')
    expect(f(person, 'charms')).toStrictEqual(['programming'])
  })
  test('Try out filtering on items in array with context w/ jsonpath syntax', () => {
    const f = queryBuilder('$.interests.[?(@ > $)]')
    expect(f(person, 'charms')).toStrictEqual(['programming'])
  })
  test('Try out filtering on attributes on items in array with context attribute', () => {
    const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, { "context": "age" }] }.name')
    expect(f(person, { age: 20 })).toStrictEqual(['Bob', 'Kevin', 'Steve'])
  })
  test('Try out filtering on attributes on items in array with context attribute w/ JSONPath Syntax', () => {
    const f = queryBuilder('$.friends.[?(!(@.age <= $.age))].name')
    expect(f(person, { age: 20 })).toStrictEqual(['Bob', 'Kevin', 'Steve'])
  })
})
describe('Object Query Builder', () => {
  test('Fetch specific attributes', () => {
    const f = objectQueryBuilder({
      nameLength: '$.name.length',
      age: '$.age',
      friendCount: '$.friends.length',
      friends: '$.friends.*.name',
      nested: {
        name: '$.name'
      }
    })
    expect(f(person)).toStrictEqual({
      age: 23,
      friendCount: 4,
      friends: [
        'Bob',
        'Kevin',
        'Steve',
        'Aaron'
      ],
      nameLength: 14,
      nested: {
        name: 'Jesse Mitchell'
      }
    })
  })
  test('Create an array', () => {
    const f = objectQueryBuilder(['$.body.longitude', '$.body.latitude'])
    const arr = f({
      body: {
        latitude: 44,
        longitude: 23
      }
    })
    expect(arr).toStrictEqual([23, 44])
  })
})
function reduce (generator, func, start) {
  if (typeof start === 'undefined') {
    start = generator.next()
  }
  let current = start
  for (const value of generator) {
    current = func(current, value)
  }
  return current
}
describe('Generator Query Builder', () => {
  test('Add some values from an array', () => {
    const f = generatorBuilder('$.values.*')
    const val = reduce(f({
      values: [1, 2, 3, 4, 5]
    }), (a, b) => a + b, 0)
    expect(val).toBe(15)
  })
})
