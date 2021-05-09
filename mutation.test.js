const { mutationBuilder } = require('.')

const personCreator = () => ({
    age: 23,
    name: 'Jesse Mitchell',
    interests: ['programming', 'business'],
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

    test('Complex mutation', () => {
        const person = personCreator()
        const f = mutationBuilder('$.interests.*')
        expect(f(person, i => i + 1).interests).toStrictEqual(['programming1', 'business1'])
    })


})