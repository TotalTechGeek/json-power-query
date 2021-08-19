# JSON Power Query

This is a simple JSON querying mechanism similar to jsonpath. This mechanism allows for ultra-fast queries by "compiling" your queries into evaluated JavaScript.

At the same time, the mechanism uses `json-logic-engine` to power its filtering, to prevent the unsafe evaluation of any JavaScript code.

### Examples 

Given the following: 
```js
const request = {
    body: {
        name: "John Doe",
        age: 35,
        friends: [
            {
                name: "Steve",
                age: 23
            },
            {
                name: "Bob",
                age: 65
            },
            {
                name: "Erik",
                age: 33
            }
        ]
    },
    params: {
        id: 101
    }
}
```


Requesting a single property: 
```js
const { queryBuilder, objectQueryBuilder } = require('json-query-engine')
const nameGetter = queryBuilder('$.body.name')
console.log(nameGetter(request)) // prints: John Doe
```


Requesting nested properties from an array: 
```js
const friendsNames = queryBuilder('$.body.friends.*.name')
console.log(JSON.stringify(friendsNames(request))) // prints: ["Steve", "Bob", "Erik"]
```

Requesting filtered values from an array: 
```js
// the filtering uses json-logic-engine, and uses truthiness.
const olderFriendNames = queryBuilder('$.body.friends.*{ ">": [{ "var": "age" }, 30] }.name')
console.log(JSON.stringify(olderFriendNames(request))) // prints: ["Bob", "Erik"]
```

Alternatively, you can use the more normal looking JSONPath Syntax:
```js
const olderFriendNames = queryBuilder('$.body.friends.[?(@.age > 30)].name')
console.log(JSON.stringify(olderFriendNames(request))) // prints: ["Bob", "Erik"]
```


You can also build a function that transforms object shapes into different shapes:
```js
const f = objectQueryBuilder({
    name: '$.body.name',
    friends: '$.body.friends.*.name',
    id: '$.params.id',
    meta: {
        friendAges: '$.body.friends.*.age'
    }
})

const y = f(request)  
/* Generates:
 * { 
 *     "name": "John Doe", 
 *     "friends": [ 
 *         "Steve", 
 *         "Bob", 
 *         "Erik" 
 *     ], 
 *     "id": 101, 
 *     "meta": { 
 *         "friendAges": [ 
 *             23, 
 *             65, 
 *             33 
 *         ] 
 *     } 
 * }
 */ 

```