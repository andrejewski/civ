const chalk = require('chalk')
const execa = require('execa')
const asciEscapes = require('ansi-escapes')
const inputPipe = process.stdin
const outputPipe = process.stdout

let sceneWidth = outputPipe.columns
let sceneHeight = outputPipe.rows
let initialSceneHeight
let userInput = ''
const logs = []
const lines = []
const startTime = Date.now()

function setupScene () {
  initialSceneHeight = sceneHeight
  outputPipe.write(Array(sceneHeight).fill('').join('\n'))
  outputPipe.write(asciEscapes.clearScreen)
  updateScene()
}

function formatTime (inputSeconds) {
  const isReal = typeof inputSeconds === 'number' && isFinite(inputSeconds)
  if (!isReal) {
    return '--:--'
  }

  const minuteSeconds = 60
  const hourSeconds = minuteSeconds * 60

  const hours = Math.floor(inputSeconds / hourSeconds)
  const minutes = Math.floor((inputSeconds % hourSeconds) / minuteSeconds)
  const seconds = Math.floor(inputSeconds % minuteSeconds)

  const minTwoDigit = num => ('' + num).padStart(2, '0')

  if (hours) {
    return `${hours}:${minTwoDigit(minutes)}:${minTwoDigit(seconds)}`
  }

  return `${minutes}:${minTwoDigit(seconds)}`
}

function getSearchResults (logs) {
  if (!userInput) {
    return []
  }

  let regex
  try {
    regex = new RegExp(userInput, 'i')
  } catch (error) {
    return []
  }

  return logs
    .map(log => log.toString())
    .filter(log => regex.test(log))
}

function updateScene () {
  outputPipe.write(asciEscapes.cursorHide)
  outputPipe.write(asciEscapes.clearScreen)

  const userLineCount = 2
  const logLineCount = sceneHeight - userLineCount
  const logSpace = Array(logLineCount).fill('')
  const lineCount = lines.length
  const searchResults = getSearchResults(logs)

  let rowIndex = logLineCount
  let resultIndex = searchResults.length
  while (rowIndex) {
    const searchResult = searchResults[--resultIndex]
    if (!searchResult) {
      break
    }

    const searchLines = searchResult.split('\n').filter(line => line.length > 0)
    let lineIndex = searchLines.length
    while (lineIndex--) {
      const line = searchLines[lineIndex]
      const fullLine = line.padEnd(sceneWidth)
      logSpace[--rowIndex] = chalk.bgYellow.black(fullLine)
      if (!rowIndex) {
        break
      }
    }
  }

  let lineIndex = lineCount
  while (rowIndex--) {
    const newerLine = lines[--lineIndex]
    if (!newerLine) {
      logSpace[rowIndex] = chalk.dim('-- BEGIN --')
      break
    }
    logSpace[rowIndex] = lines[lineIndex]
  }

  const time = formatTime(Math.floor((Date.now() - startTime) / 1000))
  const stats = `L${lineIndex + 1}-${lineCount} / C${logs.length} | ${time}`

  let lead = ''
  if (userInput) {
    const count = searchResults.length
    lead = `${count} match${count === 1 ? '' : 'es'}`
  }

  const statusLine = chalk.inverse(` ${lead}${stats.padStart(sceneWidth - lead.length - 2)} `)

  logSpace.push(statusLine, userInput)
  const scene = logSpace.join('\n')

  outputPipe.write(scene)
  outputPipe.write(asciEscapes.cursorShow)
}

function onEnd () {}

function onChunk (data) {
  logs.push(data)
  lines.push(...data.toString().split('\n').filter(line => line.length > 0))
  updateScene()
}

function onResize () {
  sceneWidth = outputPipe.columns
  sceneHeight = outputPipe.rows
  updateScene()
}

const isWindows = process.platform === 'win32'
const keys = {
  backspace: isWindows ? '08' : '7f',
  escape: '1b',
  controlC: '03',
  controlD: '04'
}

function onKeypress (key) {
  const isExit = (
    key === keys.controlC ||
    key === keys.controlD ||
    key === keys.escape
  )
  if (isExit) {
    process.exit(0)
  }

  const char = Buffer.from(key, 'hex').toString()
  userInput = key === keys.backspace
    ? userInput.slice(0, -1)
    : userInput + char
  updateScene()
}

function didStart (target) {
  target.addListener('data', onChunk)
  outputPipe.addListener('resize', onResize)
  inputPipe.addListener('end', onEnd)

  if (typeof inputPipe.setRawMode === 'function') {
    inputPipe.setRawMode(true)
    inputPipe.resume()
    inputPipe.setEncoding('hex')
    inputPipe.on('data', onKeypress)
  }

  setupScene()
}

function willStop (target) {
  target.removeListener('data', onChunk)
  outputPipe.removeListener('resize', onResize)
  inputPipe.removeListener('end', onEnd)
  inputPipe.removeListener('data', onKeypress)

  outputPipe.write(asciEscapes.eraseScreen)
  outputPipe.write(asciEscapes.eraseLines(initialSceneHeight))
  logs.forEach(log => {
    outputPipe.write(log)
  })
}

const [command, ...args] = process.argv.slice(2)
const stream = execa(command, args)

stream.catch(error => {
  console.error(error)
  process.exit(1)
})

didStart(stream.stdout)
process.on('exit', () => {
  willStop(stream.stdout)
})
