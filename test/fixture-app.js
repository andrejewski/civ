const logInterval = 300

let x = 0
let n = 0

const phrases = [
  () => 'GET /api/sandwiches/tuna',
  () => `GET /api/toggles?org_id=${x++}`,
  () => 'POST /api/people',
  () => `PUT /api/people/${n++}`,
  () => 'DELETE /api/my-life'
]

function getPhrase () {
  return phrases[Math.floor(Math.random() * 10)]
}

setInterval(() => {
  const phrase = getPhrase()
  if (phrase) {
    console.log(`[${(new Date()).toLocaleTimeString()}] ${phrase()}`)
  }
}, logInterval)
