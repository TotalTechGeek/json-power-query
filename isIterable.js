export default function isIterable (obj) {
  return obj != null && typeof obj[Symbol.iterator] === 'function'
}
