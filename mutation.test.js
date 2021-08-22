const { mutationBuilder, _advancedQueryBuilder } = require('.')


function createRemover(query) {
    const f = _advancedQueryBuilder(query, { parent: true })
    return function () {
        const result = f(...arguments)
        for(const [item, arr] of result) {
            const index = arr.indexOf(item)
            arr.splice(index, 1)
        }
        return arguments[0]
    }
}

const personCreator = () => ({
    age: 23,
    name: 'Jesse Mitchell',
    interests: ['programming', 'business'],
    friends: [{
        name: 'Bob',
        age: 25,
        interests: [{ type: 'fun' }]
    }, {
        name: 'Kevin',
        age: 23,
        interests: [{ type: 'fun' }, { type: 'see' }]
    }, {
        name: 'Steve',
        age: 32
    }, {
        name: 'Aaron',
        age: 17
    }]
})

describe('Mutation Tests', () => {

    test('Simple mutation (fixed)', () => {
        const person = personCreator()
        const f = mutationBuilder('$.age')
        expect(f(person, 24)).toStrictEqual({ ...person, age: 24 })
    })


    test('Simple mutation (variable)', () => {
        const person = personCreator()
        const f = mutationBuilder('$.age')
        expect(f(person, i => i + 1)).toStrictEqual({ ...person, age: 24 })
    })


    test('Complex nested mutation', () => {
        const person = personCreator()
        const f = mutationBuilder('$.friends.*.interests.*.type')
        f(person, 'changed')
        expect(person.friends.flatMap(i => i.interests).filter(i=>i).map(i=>i.type)).toStrictEqual(['changed', 'changed', 'changed'])  
    })

    test('Complex mutation', () => {
        const person = personCreator()
        const f = mutationBuilder('$.interests.*')
        expect(f(person, i => i + 1).interests).toStrictEqual(['programming1', 'business1'])
    })

    test('Removal mutation (using a query w/o context)', () => {
        const person = personCreator()
        const f = createRemover('$.friends.*{ "<": [{ "var": "age" }, 30] }')
        expect(f(person).friends).toStrictEqual([{
            name: 'Steve',
            age: 32
        }])
    })

    test('Removal mutation (using a query w/ context)', () => {
        const person = personCreator()
        const f = createRemover('$.friends.*{ "<": [{ "var": "age" }, { "context": "" }] }')
        expect(f(person, 30).friends).toStrictEqual([{
            name: 'Steve',
            age: 32
        }])
    })

    test('Removal mutation (using a JSONPath query w/ context)', () => {
        const person = personCreator()
        const f = createRemover('$.friends.[?(@.age < $)]')
        expect(f(person, 30).friends).toStrictEqual([{
            name: 'Steve',
            age: 32
        }])
    })
})