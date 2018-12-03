const verser = require('..')
const delay = require('delay')

async function main () {
  for (let x = 0; x < 1000; x++) {
    await verser.set('hello', `<html>
<head>
  <title>Hi</title>
</head>
<body>
<p id="p1">Hello, World!</p>
<p id="p2">Counter = ${x}</p>
</body></html>`)
    await delay(5000)
  }
}

main()
