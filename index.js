const {
    LogicEngine
} = require('json-logic-engine')
const engine = new LogicEngine()
const isIterable = obj => obj != null && typeof obj[Symbol.iterator] === 'function'


let currentQueryObject = {}
engine.addMethod('context', (key) => {
    if (!key) {
        return currentQueryObject
    }
    return currentQueryObject[key]
})

function accessor (key) {
    if (((key||'').match(/[\(\)\+\[\]]/) || key.match(/^[0-9]/)) && !key.startsWith('"')) {
        key = `"${key}"`
    }

    if (key.startsWith('"')) {
        return `[${key}]`
    }
    return `.${key}`
}

/**
 * Builds a simple object query (no array nesting)
 * @param {String} query The query to be converted into a function
 * @param {Boolean} evaluate Determines whether to output a string or a function
 * @returns {Function|String}
 */
function _simpleQueryBuilder(query, { evaluate = true }) {
    if (query === '$') {
        return i => i
    }
    query = query.substring(2).split('.')

  

    const result = `(data => (a=>typeof a === "undefined" ? null : a)(${query.reduce((str, data) => {
        return `(${str} || 0)${accessor(data)}`
    }, 'data')}))`


    // node 14 version, perf not much diff :p
    // const result = `((context, current) => context?.${query.map(i => {
    //     if(i.startsWith('"')) {
    //         return `[${i}]`
    //     }
    //     return i
    // }).join('?.')} ?? null)`

    if (!evaluate) {
        return result
    }

    return eval(result)
}


/**
 * Builds a complex query that supports arrays & logic.
 * @param {String} query 
 * @param {Boolean} evaluate 
 * @param {Array} logic 
 * @returns {Function|String}
 */
function _advancedQueryBuilder(query, { evaluate = true, logic = [], parent = false } = {}) {
    const pieces = ['']
    const splitQuery = query.split('.')
    splitQuery.shift()
    let contextUsed = false
    for (let i = 0; i < splitQuery.length; i++) {
        let item = splitQuery[i]
        if (item.startsWith('*')) {
            pieces.push('')
            item = item.substring(1)

            let str = item
            while(str && item && !str.endsWith('}')) {
                item = splitQuery[++i]
                str += `.${item}`
            }

            // not necessarily true, but will work for our use cases
            if (str.includes('"context"')) contextUsed = true


            logic.push(str.trim() ? engine.build(JSON.parse(str.trim())) : null)
            continue
        }
        pieces[pieces.length - 1] += `.${item}`
    }

    let start = pieces.shift()

    function queryMaker(query, origin, defaultValue) {
        if (!query) return origin
        query = query.substring(1) // get rid of dot
        query = query.split('.')


        const res = `(a=>typeof a === "undefined" ? ${defaultValue} : a)(${query.reduce((str, data) => {
            return `(${str} || 0)${accessor(data)}`
        }, origin)})`

        return res
    }

    let loopString = ''


    for (let i = 0; i < pieces.length; i++) {
        const last = i === pieces.length - 1
        const first = i === 0

        const iterated = first ? 'beginning' : `i_${i-1}`
        loopString += `if (isIterable(${iterated})) for (const l_${i} of ${iterated}) {
            ${logic[i] ? `if(!logic[${i}](l_${i})) continue;` : ''}
            const i_${i} = ${queryMaker(pieces[i], `l_${i}`, last ? 'null' : '[]')};
        `
        if (parent) {
            loopString += `${last ? `results.push([i_${i}, ${iterated}]); ${'}'.repeat(pieces.length)}` : ''}`
        }
        else {
            loopString += `${last ? `results.push(i_${i}); ${'}'.repeat(pieces.length)}` : ''}`
        }
    }

    const result = `((data, current) => { ${contextUsed ? 'currentQueryObject = current;' : ''} const results = []; const beginning = ${queryMaker(start, 'data', '[]')}; ${loopString}; return results; })`

    if (!evaluate) {
        return result
    }

    return eval(result)

}

/**
 * Builds a function to query an object with.
 * @param {String} query 
 * @param {Boolean} evaluate 
 * @param {Array} logic 
 * @returns {Function|String}
 */
function queryBuilder(query, { evaluate = true, logic = [] } = {}) {
    if (!query.startsWith('$')) {
        throw new Error('Query is not valid')
    }

    if (query.includes('.*')) {
        return _advancedQueryBuilder(query, { evaluate, logic })
    } else {
        return _simpleQueryBuilder(query, { evaluate })
    }
}

/**
 * Builds a simple function that'll mutate the data at the given query
 * with the data passed in
 * @param {String} query 
 * @param {Boolean} evaluate 
 * @returns 
 */
function _simpleMutationBuilder(query, { evaluate = true } = {}) {

    query = query.substring(2).split('.')


    const querySection = query.reduce((str, item) => {
        return `(${str} || 0)${accessor(item)}`
    }, 'data')

    const result = `((data, mutator, current) => { ${querySection} = typeof mutator === "function" ? mutator(${querySection}) : mutator; return data })`

    if (!evaluate) {
        return result
    }

    return eval(result)
}

/**
 * Builds a function that'll mutate the given data at the given query destination
 * for the data passed in.
 * @param {String} query 
 * @param {Boolean} evaluate 
 * @param {Array} logic 
 * @returns 
 */
function _advancedMutationBuilder(query, { evaluate = true, logic = [] } = {}) {
    const pieces = ['']
    const splitQuery = query.split('.')
    splitQuery.shift()
    let contextUsed = false
    for (let i = 0; i < splitQuery.length; i++) {
        let item = splitQuery[i]
        if (item.startsWith('*')) {
            pieces.push('')
            item = item.substring(1)

            let str = item
            while(str && item && !str.endsWith('}')) {
                item = splitQuery[++i]
                str += `.${item}`
            }

            // not necessarily true, but will work for our use cases
            if (str.includes('"context"')) contextUsed = true


            logic.push(str.trim() ? engine.build(JSON.parse(str.trim())) : null)
            continue
        }
        pieces[pieces.length - 1] += `.${item}`
    }

    let start = pieces.shift()

    function queryMaker(query, origin, defaultValue) {
        if (!query) return origin
        query = query.substring(1) // get rid of dot
        query = query.split('.')


        let res = `${query.reduce((str, data) => {
            return `(${str} || 0)${accessor(data)}`
        }, origin)}`

        if (typeof defaultValue !== 'undefined') {
            res = `(a=>typeof a === "undefined" ? ${defaultValue} : a)(${res})`
        }

        return res
    }

    let loopString = ''

    function createAssignment(item) {
        return `${item} = typeof mutator === "function" ? mutator(${item}) : mutator`
    }

    for (let i = 0; i < pieces.length; i++) {
        const last = i === pieces.length - 1
        const first = i === 0

        const iterated = first ? 'beginning' : `i_${i-1}`
        loopString += `if (isIterable(${iterated})) for (let index_${i} = 0; index_${i} < ${iterated}.length; index_${i}++) {
            ${logic[i] ? `if(!logic[${i}](${iterated}[index_${i}])) continue;` : ''}
            ${last && pieces[i] ? createAssignment(`${queryMaker(pieces[i], `${iterated}[index_${i}]`, undefined)}`) : createAssignment(`${iterated}[index_${i}]`) }
            ${last ? `${'}'.repeat(pieces.length)}` : ''}
        `
    }

    const result = `((data, mutator, current) => { ${contextUsed ? 'currentQueryObject = current;' : ''} let beginning = ${queryMaker(start, 'data', '[]')}; ${loopString}; return data; })`

    if (!evaluate) {
        return result
    }

    return eval(result)
}


/**
 * Creates a function that modifies the object at a destination
 * designated by the query. The function takes in the data, the modifier (constant or function),
 * and / or context you might wish to use for any filters.
 * @param {String} query 
 * @param {Boolean} evaluate 
 * @param {Array} logic 
 * @returns 
 */
function mutationBuilder(query, { evaluate = true, logic = [] } = {}) {
    if (!query.startsWith('$')) {
        throw new Error('Query is not valid')
    }

    if (query === '$') {
        throw new Error('Cannot mutate top level')
    }

    if (query.includes('.*')) {
        return _advancedMutationBuilder(query, { evaluate, logic })
    } else {
        return _simpleMutationBuilder(query, { evaluate })
    }
}



/**
 * 
 * @param {Object} obj 
 * @param {{ evaluate?: Boolean, logic?: Array }} param1 
 * @returns 
 */
function objectQueryBuilder(obj, { evaluate = true, logic = [] } = {}) {
    const result = (`((data, current) => ({${Object.keys(obj).map(key => {

        if (typeof obj[key] === 'object') {
            return `${JSON.stringify(key)}: ${objectQueryBuilder(obj[key], { evaluate: false, logic })}(data, current)`
        }

        return `${JSON.stringify(key)}: ${queryBuilder(obj[key], { evaluate: false, logic })}(data, current)`
    }).join(', ')}}))`)


    if (!evaluate) return result

    return eval(result)
}


module.exports = {
    objectQueryBuilder,
    queryBuilder,
    _advancedQueryBuilder,
    mutationBuilder,
    engine
}

