(async function () {
    function empty (element) {
        while (element.firstChild) {
            element.firstChild.remove()
        }
    }

    function makeInputControl (key, label, getSuggestions) {
        const $group = document.getElementById(`group_${key}`)

        const $input = document.createElement('input')
        $input.setAttribute('hidden', '')
        $input.setAttribute('name', key)
        $input.setAttribute('id', key)
        $group.appendChild($input)

        const $label = document.createElement('label')
        $label.textContent = label
        $label.setAttribute('for', `search_${key}`)
        $group.appendChild($label)

        const $searchGroup = document.createElement('div')
        $searchGroup.setAttribute('class', 'search-group')
        $group.appendChild($searchGroup)

        const $searchInput = document.createElement('input')
        $searchInput.setAttribute('id', `search_${key}`)
        $searchGroup.appendChild($searchInput)
        const $searchResults = document.createElement('ol')
        $searchGroup.appendChild($searchResults)

        $searchInput.addEventListener('input', async function () {
            const results = await getSuggestions($searchInput.value)

            empty($searchResults)
            for (const result of results) {
                const $searchResult = document.createElement('li')
                $searchResult.appendChild(result.$result)
                $searchResult.setAttribute('data-value', result.value)
                $searchResult.setAttribute('data-display-value', result.displayValue)

                const $searchResultSelect = document.createElement('button')
                $searchResultSelect.addEventListener('click', function (event) {
                    $input.value = $searchResult.getAttribute('data-value')
                    $searchInput.value = $searchResult.getAttribute('data-display-value')
                    empty($searchResults)
                    $searchInput.focus()
                    event.preventDefault()
                })

                $searchResult.appendChild($searchResultSelect)
                $searchResults.appendChild($searchResult)
            }
        })
    }

    async function getTaxonSuggestions (query) {
        const q = encodeURIComponent(query)
        const response = await fetch(`https://api.gbif.org/v1/species/suggest?q=${q}&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`)
        const results = await response.json()
        return results.slice(0, 5).map(function (result) {
            const $result = new DocumentFragment()

            const $rank = document.createElement('span')
            $rank.textContent = result.rank.toLowerCase()
            $rank.setAttribute('class', 'search-taxon-rank')
            $result.appendChild($rank)

            {
                const $main = document.createElement('span')
                $main.setAttribute('class', 'search-taxon-main')

                const $full = document.createElement('span')
                $full.textContent = ' ' + result.scientificName.slice(result.canonicalName.length + 1)
                $full.setAttribute('class', 'search-taxon')
                $main.appendChild($full)

                const $name = document.createElement('span')
                $name.textContent = result.canonicalName
                $name.setAttribute('class', 'search-taxon-name')
                $full.prepend($name)

                $result.append($main)
            }
            {
                const $sub = document.createElement('span')
                $sub.textContent = Object.values(result.higherClassificationMap).slice(2, 5).join(' > ')
                $sub.setAttribute('class', 'search-taxon-sub')
                $result.append($sub)
            }

            return { value: result.key, displayValue: result.scientificName, $result }
        })
    }

    makeInputControl('taxon', 'Taxon', getTaxonSuggestions)

    async function getTaxonParents (query) {
        const response = await fetch(`https://api.gbif.org/v1/species/${params.get('taxon')}/parents`)
        const results = await response.json()
        return results.map(result => result.canonicalName)
    }

    async function getTaxon (query) {
        return fetch(`https://api.gbif.org/v1/species/${params.get('taxon')}`).then(r => r.json())
    }

    let placeMap = {}
    async function getPlaces (query) {
        const [lat, long] = query.split(',')
        const response = await fetch(`https://api.inaturalist.org/v1/places/nearby?nelat=${lat}&nelng=${long}&swlat=${lat}&swlng=${long}`)
        const results = await response.json()
        return results.results.standard.map(result => placeMap[result.id]).filter(Boolean)
    }

    const RANKS = [
        'kingdom',
        'phylum',
        'class',
        'superorder',
        'order',
        'suborder',
        'infraorder',
        'superfamily',
        'family',
        'subfamily',
        'tribe',
        'genus',
        'subgenus',
        'group',
        'species',
        'subspecies',
        'variety',
        'form'
    ]
    function compareRanks (a, b) {
        return RANKS.indexOf(a) - RANKS.indexOf(b)
    }

    const fieldsToDisplay = ['id', 'title', 'scope', 'key_type', 'fulltext_url', 'language']
    const $tableHeaders = document.getElementById('result_headers')
    for (const header of fieldsToDisplay) {
        const $header = document.createElement('th')
        $header.textContent = fieldLabels[header]
        $tableHeaders.appendChild($header)
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has('taxon') && params.has('location')) {
        placeMap = await fetch('./data/places.json').then(r => r.json())

        const taxon = await getTaxon(params.get('taxon'))
        const taxa = await getTaxonParents(params.get('taxon'))
        taxa.push(taxon.key === 0 ? 'Biota' : taxon.canonicalName)
        document.getElementById('taxon').value = taxon.key
        document.getElementById('search_taxon').value = taxon.scientificName
        document.getElementById('location').value = params.get('location')

        const places = await getPlaces(params.get('location'))
        places.unshift('-')
        console.log(taxa, places)

        const [headers, ...rows] = await loadCatalog()
        const results = []

        for (const row of rows) {
            const record = row.reduce((record, value, index) => (record[headers[index]] = value, record), {})

            let closestTaxon = 0
            for (const taxon of record.taxon.split('; ')) {
                const index = taxa.indexOf(taxon) + 1
                if (index && closestTaxon < index) {
                    closestTaxon = index
                }
            }
            record._score = closestTaxon / taxa.length

            if (!record.region.split('; ').some(place => places.includes(place))) {
                record._score = 0
            }

            if (!record.fulltext_url && !record.archive_url) {
                record._score *= 0.9
            }

            if (record.target_taxa) {
                let every = false
                let some = false
                for (const target of record.target_taxa.split('; ')) {
                    const match = compareRanks(taxon.rank.toLowerCase(), target) < 0
                    every = every && match
                    some = some || match
                }
                record._score *= every ? 1 : some ? 0.9 : 0;
            }

            if (record.complete === 'FALSE') {
                record._score *= 0.9
            }

            if (record.key_type) {
                const types = record.key_type.split('; ')
                if (types.includes('key') || types.includes('matrix')) {
                    // record._score *= 1
                } else if (types.includes('reference')) {
                    record._score *= 0.9
                } else if (types.includes('gallery')) {
                    record._score *= 0.8
                } else {
                    record._score *= 0.7
                }
            }

            if (record.date) {
                const year = record.date.split('-')[0]
                record._score *= 1 - (1 / year)
            }

            if (record._score > 0) {
                results.push(record)
            }
        }

        results.sort((a, b) => b._score - a._score)

        const tableRows = document.getElementById('results')
        empty(tableRows)
        for (const rowData of results) {
            const tableRow = document.createElement('tr')

            for (const header of fieldsToDisplay) {
                const tableCell = document.createElement('td')
                const value = rowData[header]

                if (header.endsWith('url')) {
                    tableCell.innerHTML = value || rowData.archive_url ? octicons.available : octicons.not_available
                } else if (header.endsWith('_type') && value) {
                    tableCell.innerHTML = value.split('; ').map(value => octicons[value] || value).join(' ')
                } else if (header === 'id') {
                    const a = document.createElement('a')
                    a.setAttribute('class', 'row-link')
                    a.setAttribute('target', 'detail')
                    a.setAttribute('href', `/catalog/detail?id=${value}&embed`)
                    a.textContent = value
                    tableCell.appendChild(a)
                } else {
                    tableCell.textContent = value
                }

                tableRow.appendChild(tableCell)
            }

            tableRows.appendChild(tableRow)
        }
    }
})()
