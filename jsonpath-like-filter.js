
// A not so great implementation of a formula parser.
// I could've gone with an OTS library that supported this functionality, but to eliminate dependencies I 
// just wanted to quickly throw something together.

const priorities = [['||'], ['&&'], ['!==', '!=', '===', '=='], ['<=', '<', '>', '>=', 'in'], ['+', '-'], ['%'], ['*', '/'], ['**'], ['!']].reverse()
const allOperators = priorities.reduce((a,b) => a.concat(b), []) 
const unary = new Set(['!'])

const operatorFunctions = {
    '!': 'not',
    '+': 'add',
    '*': 'mul',
    '**': 'exp',
    '-': 'sub',
    '/': 'div',
    '%': 'mod',
    '||': 'or',
    'in': 'In',
    '&&': 'and',
    '<': 'lt',
    '<=': 'lte',
    '>': 'gt',
    '>=': 'gte',
    '!=': 'ne',
    '==': 'eq',
    '===': 'eeq',
    '!==': 'neeq'
}

function invert (obj) { 
    const result = {}
    for (const key in obj) {
        result[obj[key]] = key
    }
    return result
}

const logicalOps = invert(operatorFunctions) 
logicalOps.or = 'or'
logicalOps.and = 'and'
logicalOps.In = 'in'

/**
 * 
 * @param {string} str 
 */
function replace (str) {
    let cur = ''
    let p = ''
    let count = 0
    for(let i = 0; i < str.length; i++) {
        if (str[i] === '(') count++
        if (str[i] === ')') {
            count--
            if(!count) {
                cur += replace(p.substring(1)) 
                p = ''
                continue
            }
        }
        if(!count) {
            cur += str[i]
        } else {
            p += str[i]
        }
    }
    str = cur

    str = str.replace(/ /g, '')
    for (const operators of priorities) {
        let arr = operators.map(i => [i, str.indexOf(i)]).filter(i=>i[1] !== -1).sort((a,b) => a[1]-b[1])
        
        const matching = allOperators.filter(i => arr.find(a => i !== a[0] && i.startsWith(a[0]))) 

        
        
        while(arr.length) {
            const [operator, index] = arr.shift()
            
            if (matching.find(match => {
                if (operator === match) return false
                return str.indexOf(match) === index
            })) continue;

            let prevIndex = index-1
            while(prevIndex >= 1 && /[$@.A-Za-z0-9_(),'"#]/.exec(str[prevIndex - 1])) {
                prevIndex--;
            }
        
            let nextIndex = index + operator.length
            while(nextIndex < str.length +1 && /[$@.A-Za-z0-9_(),'"#]/.exec(str[nextIndex + 1])) {
                nextIndex++;
            }

            const after = str.substring(index+operator.length, nextIndex+1);
           
            if (unary.has(operator)) {
                const replaceWith = `${operatorFunctions[operator]}(${after})` //?
                str = str.substring(0, index) + replaceWith + str.substring(nextIndex+1)
            }
            else {
                const before = str.substring(prevIndex, index)
                const replaceWith = `${operatorFunctions[operator]}(${before},${after})` //?
                str = str.substring(0, prevIndex) + replaceWith + str.substring(nextIndex+1)
            }

            arr = operators.map(i => [i, str.indexOf(i)]).filter(i=>i[1] !== -1).sort((a,b) => a[1]-b[1])
        }
    }
    return str 
}

function splitOutsideParenthesis (str, splitter =',') {
    const result = []
    let cur = ''
    let parenth = 0
    for(let i = 0; i < str.length; i++) {
        if(str[i] === '(') parenth++
        if (str[i] === ')') parenth--
        
        if (str[i] === splitter && !parenth) {
            result.push(cur)
            cur = ''
        }
        else {
            
            cur += str[i]
        }
    }
    result.push(cur)
    return result

}


/**
 * 
 * @param {string} str 
 */
function toLogic (str, strings) {
    if (/^[0-9.]+$/g.exec(str)) {
        return Number(str)
    }

    if (str.indexOf('(') !== -1) {
        
        const [head, ...tail] = str.split('(')

        let rest =  tail.join('(')
        rest = rest.substring(0, rest.length -1)
        
        
        const operands = splitOutsideParenthesis(rest)
        
        
        if (operands.length > 1) {
            return { [logicalOps[head]]: operands.map(i => toLogic(i, strings)) }
        }
        
        return { [logicalOps[head]]: toLogic(operands[0], strings) }
    }

    if (str.startsWith('@.')) {
        return { var: str.substring(2) }
    } 
    else if (str === '@') {
        return {var: ''}
    }

    if (str.startsWith('$.')) {
        return { context: str.substring(2) }
    } else if (str === '$') {
        return { context: ''}
    }

    if (str === 'true' || str === 'false') {
        return str === 'true'
    }

    
    if ((str.startsWith('\'') && str.endsWith('\'')) || (str.startsWith('\"') && str.endsWith('\"'))) {
        return str.substring(1, str.length -1)
    }

    if (str.startsWith('#')) {
        return strings[+str.substring(1)]
    }

    throw new Error('Not a valid query')
}

/**
 * Simple mechanism for removing the string variables. 
 * @param {string} str 
 */
function removeStrings (str) {
    const strings = []
    let cur = ''
    let quoteMode = 0
    let backslash = false
    for (let i = 0; i < str.length; i++) {
        if (!backslash && str[i] === '"') {
            if (quoteMode === 1) {
                quoteMode = 0
            } else if (!quoteMode) {
                cur += '#' + strings.length
                strings.push('')
                quoteMode = 1
            }
        }
        else if (!backslash && str[i] === "'") {
            if (quoteMode === 2) {
                quoteMode = 0
            } else if (!quoteMode) {
                cur += '#' + strings.length
                strings.push('')
                quoteMode = 2
            }
        } 
        else if (str[i] === '\\') {
            backslash = true
        }
        else if (quoteMode) {
            backslash = false
            strings[strings.length - 1] += str[i]
        }
        else {
            backslash = false
            cur += str[i]
        }
    }

    return { text: cur, strings }

}


function generateLogic (str) {
    const expr = /^\[\?\([A-Za-z0-9 $@.!&*+-<=>|$()'"/%\\]+\)\]$/
    if (expr.exec(str)) {
        const query = str.substring(3, str.length -2) //?
        const { text, strings } = removeStrings(query)
        return toLogic(replace(text), strings)
    }
    else {
        throw new Error('Not a valid query')
    }
}

module.exports = { generateLogic }