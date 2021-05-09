const { queryBuilder, objectQueryBuilder } = require('.')


const person = {
    age: 23,
    name: 'Jesse Mitchell',
    interests: ['programming', 'business'],
    "odd thing": 7,
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

    test('Try out filtering', () => {
        const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, 20] }.name')
        expect(f(person)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
    })

    test('Try out filtering with context', () => {
        const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, { "context": "" }] }.name')
        expect(f(person, 20)).toStrictEqual(['Bob', 'Kevin', 'Steve'])
    })

    test('Try out filtering with context attribute', () => {
        const f = queryBuilder('$.friends.*{ ">": [{ "var": "age" }, { "context": "age" }] }.name')
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
})