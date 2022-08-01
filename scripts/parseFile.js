module.exports = function parseFile (file) {
  const [header, ...rows] = file
    .trim()
    .replace(/$/, '\n')
    .match(/("([^"]|"")*?"|[^,\n]*)(,|\n|$)/g)
    .reduce((rows, value) => {
      const last = rows[rows.length - 1]
      if (value.endsWith('\n')) {
        rows.push([])
      }
      value = value.replace(/[,\n]$/, '')
      last.push(value.startsWith('"') ? value.replace(/""/g, '"').slice(1, -1) : value)
      return rows
    }, [[]])
    .slice(0, -1)
  return rows.map(row => row.reduce(
    (record, value, i) => (record[header[i]] = value, record),
    {}
  ))
}
