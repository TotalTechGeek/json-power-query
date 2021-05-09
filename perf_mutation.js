const { mutationBuilder } = require('.')


const people = [
    { name: 'Jesse', age: 13 },
]

const f = mutationBuilder('$.*')

f(people, i => { i.age = (i.age||0) + 1; return i })
console.log(people)
