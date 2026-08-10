const fs = require('fs').promises
const wdk = require('wikidata-sdk')
const fetch = require('node-fetch')
const parseFile = require('./parseFile.js')

async function main (places) {
  const file = await fs.readFile(places, 'utf8')
  const data = parseFile(file)
  const values = data
    .filter(record => record.qid)
    .map(record => `(wd:${record.qid} "${record.name}")`)
    .join(' ')

  const query = `SELECT ?name ?id WHERE {
  VALUES (?qid ?name) { ${values} }
  ?qid wdt:P7471 ?id .
}`

  const [url, body]  = wdk.sparqlQuery(query).split('?')
  const response = await fetch(url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Library of Identification Resources (https://identification-resources.github.io/)'
    },
    method: 'POST',
    body
  })
  const results = wdk.simplify.sparqlResults(await response.json())

  const taxa = {}
  for (const { name, id } of results) {
    taxa[id] = name
  }

  console.log(JSON.stringify(taxa, null, 2))
}

main(...process.argv.slice(2)).catch(console.error)
