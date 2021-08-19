const { mutationBuilder, _advancedQueryBuilder } = require('.')


const people = [
    { name: 'Jesse', age: 13 },
    { name: 'John', age: 10 },
]

const f = mutationBuilder('$.*')

f(people, i => { i.age = (i.age||0) + 1; return i })

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

const g = createRemover('$.[?(@.age > $)]') 
console.log(people)
console.log(g(people, 13))


const store = {}

function push(query, item) {
    const f = mutationBuilder(query)
    return f(store, i => { 
        i.push(item) 
        return i
    })
}

function set (query, item) {
    const f = mutationBuilder(query)
    f(store, item)
}

set('$.names', i => i || [])
push('$.names', { name: 'Jesse' })
console.log(store)
set('$.names.*.name', i => i.split('').reverse().join(''))
console.log(store)