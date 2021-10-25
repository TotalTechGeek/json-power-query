/* eslint-disable no-eval */
import { LogicEngine } from 'json-logic-engine'
import { generateLogic } from './jsonpath-like-filter.js'

const engine = new LogicEngine()

// eslint-disable-next-line no-unused-vars
const isIterable = obj => obj != null && typeof obj[Symbol.iterator] === 'function'

function mutateTraverse (obj, mut = i => i) {
  if (!obj) { return obj }
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      obj[key] = mutateTraverse(obj[key], mut)
    }
  }
  return mut(obj)
}

const replaceVarContext = i => {
  if (typeof i.var !== 'undefined') {
    if (i.var) {
      return {
        var: `item.${i.var}`
      }
    }
    return { var: 'item' }
  }
  if (typeof i.context !== 'undefined') {
    if (i.context) {
      return {
        var: `context.${i.context}`
      }
    }
    return { var: 'context' }
  }
  return i
}
function accessor (key) {
  if (((key || '').match(/[()+[\]]/) || key.match(/^[0-9]/)) && !key.startsWith('"')) {
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
function _simpleQueryBuilder (query, { evaluate = true }) {
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
function _parseQuery (query, { logic = [], context = [] }) {
  const pieces = ['']
  const splitQuery = query.split('.')
  splitQuery.shift()
  for (let i = 0; i < splitQuery.length; i++) {
    let item = splitQuery[i]
    const arrQuery = item.startsWith('[')
    if (item.startsWith('*') || arrQuery) {
      pieces.push('')
      item = item.substring(1)
      let str = item
      const ending = arrQuery ? ']' : '}'
      while (str && item && !str.endsWith(ending)) {
        item = splitQuery[++i]
        str += `.${item}`
      }
      if (arrQuery) {
        str = JSON.stringify(generateLogic(`[${str}`))
      }
      const { logicBody, contextUsed } = parseLogic(str)
      logic.push(logicBody)
      context.push(contextUsed)
      continue
    }
    pieces[pieces.length - 1] += `.${item}`
  }
  const start = pieces.shift()
  return { pieces, start }
}
/**
 * Builds a complex query that supports arrays & logic.
 * @param {String} query
 * @param {{ evaluate: boolean, logic: Function[], parent: boolean, context: boolean[], unsafeOverrideLogic: (i: number, iterated: string) => string } }
 * @returns {Function|String}
 */
function _advancedQueryBuilder (query, { evaluate = true, logic = [], parent = false, context = [], unsafeOverrideLogic, signature = 'function (data, context)' } = {}) {
  const { pieces, start } = _parseQuery(query, { logic, context })
  function queryMaker (query, origin, defaultValue) {
    if (!query) { return origin }
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
    const iterated = first ? 'beginning' : `i_${i - 1}`
    loopString += `if (isIterable(${iterated})) for (const l_${i} of ${iterated}) {
            ${logic[i] ? `if(!logic[${i}](${context[i] ? `{ item: l_${i}, context }` : `l_${i}`})) continue;` : ''}
            const i_${i} = ${queryMaker(pieces[i], `l_${i}`, last ? 'null' : '[]')};
        `
    if (unsafeOverrideLogic) {
      loopString += `${last ? `${unsafeOverrideLogic(i, iterated)}; ${'}'.repeat(pieces.length)}` : ''}`
    } else if (parent) {
      loopString += `${last ? `results.push([i_${i}, ${iterated}]); ${'}'.repeat(pieces.length)}` : ''}`
    } else {
      loopString += `${last ? `results.push(i_${i}); ${'}'.repeat(pieces.length)}` : ''}`
    }
  }
  const result = `(${signature} { const results = []; const beginning = ${queryMaker(start, 'data', '[]')}; ${loopString}; return results; })`
  if (!evaluate) {
    return result
  }
  return eval(result)
}
function parseLogic (str) {
  if (str.trim()) {
    const logic = JSON.parse(str.trim())
    let contextUsed = false
    mutateTraverse(logic, i => {
      if (typeof i.context !== 'undefined') { contextUsed = true }
      return i
    })
    if (contextUsed) {
      return { logicBody: engine.build(mutateTraverse(logic, replaceVarContext)), contextUsed }
    }
    return { logicBody: engine.build(logic), contextUsed }
  }
  return { logicBody: null, contextUsed: false }
}
/**
 * Builds a function to query an object with.
 * @param {String} query
 * @param {Boolean} evaluate
 * @param {Array} logic
 * @returns {Function|String}
 */
function queryBuilder (query, { evaluate = true, logic = [], context = [] } = {}) {
  if (!query.startsWith('$')) {
    throw new Error('Query is not valid')
  }
  if (query.includes('.*') || query.includes('.[')) {
    return _advancedQueryBuilder(query, { evaluate, logic, context })
  } else {
    return _simpleQueryBuilder(query, { evaluate, context })
  }
}
/**
 * Builds a simple function that'll mutate the data at the given query
 * with the data passed in
 * @param {String} query
 * @param {{ evaluate: Boolean }} options
 */
function _simpleMutationBuilder (query, { evaluate = true } = {}) {
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
function _advancedMutationBuilder (query, { evaluate = true, logic = [], context = [] } = {}) {
  const { pieces, start } = _parseQuery(query, { logic, context })
  function queryMaker (query, origin, defaultValue) {
    if (!query) { return origin }
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
  function createAssignment (item) {
    return `${item} = typeof mutator === "function" ? mutator(${item}) : mutator`
  }
  for (let i = 0; i < pieces.length; i++) {
    const last = i === pieces.length - 1
    const first = i === 0
    const iterated = first ? 'beginning' : `i_${i - 1}`
    loopString += `if (isIterable(${iterated})) for (let index_${i} = 0; index_${i} < ${iterated}.length; index_${i}++) {
            ${logic[i] ? `if(!logic[${i}](${context[i] ? `{ item: ${iterated}[index_${i}], context }` : `${iterated}[index_${i}]`})) continue;` : ''}
            ${(last && (pieces[i] ? createAssignment(`${queryMaker(pieces[i], `${iterated}[index_${i}]`, undefined)}`) : createAssignment(`${iterated}[index_${i}]`))) || ''}
            ${!last ? `const i_${i} = ${queryMaker(pieces[i], `${iterated}[index_${i}]`, last ? 'null' : '[]')};` : ''}
            ${last ? `${'}'.repeat(pieces.length)}` : ''}
        `
  }
  const result = `((data, mutator, context) => { let beginning = ${queryMaker(start, 'data', '[]')}; ${loopString}; return data; })`
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
 * @returns {(obj: *, mutator: ((item: any) => any) | any) => any}
 */
function mutationBuilder (query, { evaluate = true, logic = [] } = {}) {
  if (!query.startsWith('$')) {
    throw new Error('Query is not valid')
  }
  if (query === '$') {
    throw new Error('Cannot mutate top level')
  }
  if (query.includes('.*') || query.includes('.[')) {
    return _advancedMutationBuilder(query, { evaluate, logic })
  } else {
    return _simpleMutationBuilder(query, { evaluate })
  }
}
/**
 *
 * @param {Object} obj
 * @param {{ evaluate?: Boolean, logic?: Array }} options
 * @returns {(data: any, context: any) => any}
 */
function objectQueryBuilder (obj, { evaluate = true, logic = [], context = [] } = {}) {
  let result
  if (Array.isArray(obj)) {
    result = `((data, current) => [${obj.map(i => {
            if (typeof i === 'string') {
                return `${queryBuilder(i, { evaluate: false, logic, context })}(data, current)`
            }
            return `${objectQueryBuilder(i, { evaluate: false, logic, context })}(data, current)`
        }).join(', ')}])`
  } else {
    result = (`((data, current) => ({${Object.keys(obj).map(key => {
            if (typeof obj[key] === 'object') {
                return `${JSON.stringify(key)}: ${objectQueryBuilder(obj[key], { evaluate: false, logic, context })}(data, current)`
            }
            return `${JSON.stringify(key)}: ${queryBuilder(obj[key], { evaluate: false, logic, context })}(data, current)`
        }).join(', ')}}))`)
  }
  if (!evaluate) { return result }
  return eval(result)
}
/**
 * Constructs a generator
 * @param {string} query
 * @param {{ evaluate: boolean }} param1
 * @returns {(data: any) => Generator<any>}
 */
function generatorBuilder (query, { evaluate = true, logic = [], context = [] } = {}) {
  if (!query.startsWith('$')) {
    throw new Error('Query is not valid')
  }
  if (query.includes('.*') || query.includes('.[')) {
    return _advancedQueryBuilder(query, {
      evaluate,
      logic,
      context,
      signature: 'function * (data, context)',
      unsafeOverrideLogic: i => {
        return `yield i_${i}`
      }
    })
  }
  throw new Error('Query does not iterate over an array.')
}
export { objectQueryBuilder }
export { queryBuilder }
export { generatorBuilder }
export { _advancedQueryBuilder }
export { mutationBuilder }
export { engine }
export default {
  objectQueryBuilder,
  queryBuilder,
  generatorBuilder,
  _advancedQueryBuilder,
  mutationBuilder,
  engine
}
