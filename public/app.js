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

    async function getResourceSuggestions (query) {
        const results = []

        for (const id in DATA.catalog) {
            const row = DATA.catalog[id]

            for (let i = 1; DATA.resources[id + ':' + i]; i++) {
                const resourceId = id + ':' + i
                const resource = DATA.resources[resourceId]

                const searchValues = [
                    resource.id,
                    ...Object.values(row),
                    ...Object.values(resource.catalog || {})
                ]
                const match = searchValues.join('\u001D').toLowerCase().includes(query.toLowerCase())
                if (!match) {
                    continue
                }

                const $result = new DocumentFragment()

                const $rank = document.createElement('span')
                $rank.innerHTML = [
                    row.entry_type.split('; '),
                    row.key_type.split('; ')
                ].map(value => octicons[value] || value).join(' ')
                $rank.setAttribute('class', 'search-taxon')
                $result.appendChild($rank)

                const $main = document.createElement('span')
                $main.setAttribute('class', 'search-taxon-main')
                $result.appendChild($main)

                const $full = document.createElement('span')
                $full.textContent = ' ' + (row.date.split('-')[0] || '')
                $full.setAttribute('class', 'search-taxon')
                $main.appendChild($full)

                const $name = document.createElement('span')
                $name.textContent = row.title
                $name.setAttribute('class', 'search-taxon-name')
                $full.prepend($name)

                const $sub = document.createElement('span')
                $sub.textContent = resourceId + ': ' + resource.taxonCount + ' taxa'
                $sub.setAttribute('class', 'search-taxon-sub')
                $result.append($sub)

                results.push({
                    value: resourceId,
                    displayValue: row.title,
                    $result
                })
            }
        }

        return results.slice(0, 5)
    }

    async function getTaxon (query) {
        return fetch(`https://api.gbif.org/v1/species/${params.get('taxon')}`).then(r => r.json())
    }

    function getTaxonParents (taxon) {
        return RANKS.map(rank => taxon[rank]).filter(Boolean)
    }

    async function getPlaces (query) {
        const [lat, long] = query.split(',')
        const response = await fetch(`https://api.inaturalist.org/v1/places/nearby?nelat=${lat}&nelng=${long}&swlat=${lat}&swlng=${long}`)
        const results = await response.json()
        return results.results.standard
    }

    async function getCountryCode (id) {
        const query = encodeURIComponent(`SELECT*WHERE{"${id}"^wdt:P7471/wdt:P131*/wdt:P297?c}`)
        return fetch('https://query.wikidata.org/sparql?format=json&query=' + query)
            .then(response => response.json())
            .then(response => response.results.bindings[0].c.value)
    }

    async function getOccurrencesBySpecies (taxon, countryCode) {
        const baseUrl = `https://api.gbif.org/v1/occurrence/search?facet=speciesKey&country=${countryCode.toUpperCase()}&taxon_key=${taxon}&year=0,9999&occurrence_status=present&limit=0`

        const species = []
        const pageSize = 100
        let offset = 0
        while (true) {
            const url = `${baseUrl}&facetLimit=${pageSize}&facetOffset=${offset}`
            const response = await fetch(url).then(response => response.json()).then(response => response.facets[0].counts)
            species.push(...response)
            if (response.length < pageSize) {
                return species
            } else {
                offset += pageSize
            }
        }
    }

    async function getGbifSubtaxa (taxon) {
        const baseUrl = `https://api.gbif.org/v1/species/search?highertaxonKey=${taxon}&rank=SPECIES`

        const species = new Map()
        const pageSize = 100
        let offset = 0
        while (true) {
            const url = `${baseUrl}&limit=${pageSize}&offset=${offset}`
            const response = await fetch(url).then(response => response.json())

            for (const result of response.results) {
                species.set(result.key, result)
            }

            if (response.endOfRecords) {
                return species
            } else {
                offset += pageSize
            }
        }
    }

    async function findGbifMatches (checklist) {
        const speciesCount = checklist.length
        const countsTotal = checklist.reduce((sum, species) => sum + species.count, 0)
        const resources = {}

        for (const { name: species, count } of checklist) {
            if (species in DATA.gbif) {
                for (const id of DATA.gbif[species]) {
                    const resourceId = id.replace(/:[1-9]\d*$/, '')
                    if (!(resourceId in resources)) {
                        resources[resourceId] = {
                            speciesRatio: 0,
                            observationRatio: 0,
                            missing: new Set(checklist.map(species => species.name))
                        }
                    }
                    if (resources[resourceId].missing.has(species)) {
                        resources[resourceId].speciesRatio += 1 / speciesCount
                        resources[resourceId].observationRatio += count / countsTotal
                        resources[resourceId].missing.delete(species)
                    }
                }
            }
        }

        return resources
    }

    async function getResults (taxon, params) {
        // Get parent taxa
        const parentTaxa = getTaxonParents(taxon)
        if (taxon.key === 0) {
            parentTaxa.push('Biota')
        }

        // Get place info
        const allPlaces = await getPlaces(params.get('location'))
        const places = allPlaces.map(result => DATA.places[result.id]).filter(Boolean)
        places.unshift('-')
        const country = allPlaces.find(place => place.place_type === 12)

        // Get checklist
        let checklist
        if (params.get('checklist') === 'catalog') {
            // Use resource in catalog as basis
            const resource = await loadKey(params.get('checklist-catalog'))
            const subtaxa = await getGbifSubtaxa(taxon.key)
            checklist = Object.values(resource.taxa)
                .map(taxon => parseInt(taxon.data[27]))
                .filter((taxon, i, a) => a.indexOf(taxon) === i && subtaxa.has(taxon))
                .map(taxon => ({
                    name: taxon,
                    displayName: subtaxa.get(taxon).scientificName,
                    count: 0
                }))
        } else if (params.get('checklist') === 'search' && country) {
            // Use GBIF occurrence data
            const countryCode = await getCountryCode(country.id)
            checklist = await getOccurrencesBySpecies(taxon.key, countryCode)
        } else {
            checklist = []
        }

        console.log(parentTaxa, places, checklist)

        const results = []

        // Use the GBIF ID-based checklist and the GBIF index to keys to find keys
        const matchingResources = await findGbifMatches(checklist)
        const seenCatalogWorks = new Set()
        for (const resourceId in matchingResources) {
            const catalogId = resourceId.replace(/:[1-9]\d*$/, '')
            const resource = DATA.resources[resourceId]
            const record = Object.assign(
                {
                    _resource: resource,
                    species_ratio: matchingResources[resourceId].speciesRatio,
                    observation_ratio: matchingResources[resourceId].observationRatio,
                },
                DATA.catalog[catalogId],
                resource.catalog || {}
            )
            for (const field in record) {
                if (Array.isArray(record[field])) {
                    record[field] = record[field].join('; ')
                }
            }
            seenCatalogWorks.add(catalogId)
            results.push(record)
        }

        // Use the less granular metadata in the catalog to find works
        for (const id in DATA.catalog) {
            // Skip works that were already found with GBIF data
            if (seenCatalogWorks.has(id)) { continue }

            const record = DATA.catalog[id]

            // If works would have been found with GBIF data, indicate zero coverage.
            // The works are still included as they might still have coverage but for
            // synonym resolution.
            if (DATA.resources[id + ':1']) {
              record.species_ratio = 0
              record.observation_ratio = 0
            }

            // Determine relevance of work
            let closestTaxon = 0
            for (const taxon of record.taxon.split('; ')) {
                const index = parentTaxa.indexOf(taxon) + 1
                if (index && closestTaxon < index) {
                    closestTaxon = index
                }
            }
            if (closestTaxon === 0) {
                // Taxa not applicable
                continue
            } else {
                record.parent_proximity = closestTaxon / parentTaxa.length
            }

            if (!record.region.split('; ').some(place => places.includes(place))) {
                // Region not applicable
                continue
            }

            results.push(record)
        }

        return [results, checklist]
    }

    function makePieChart (value) {
        const $container = new DocumentFragment()
        const $chart = document.createElement('span')
        $chart.setAttribute('style', `
            width: 1.5em;
            height: 1.5em;
            border-radius: 100%;
            display: inline-block;
            vertical-align: bottom;
            background: conic-gradient(black 0%, black 0% ${value * 100}%, #989d89 ${value * 100}% 100%);
        `.trim().replace(/\s+/g, ' '))
        $container.append($chart, ` ${(value * 100).toFixed()}%`)
        return $container
    }

    async function openCoverageDialog (result, checklist) {
        const resourceTaxa = await indexCsv(`/assets/data/resources/dwc/${result._resource.id.split(':').join('-')}.csv`, 'scientificNameID')
        const resourceTaxonNames = {}
        for (const id in resourceTaxa) {
            const gbif = resourceTaxa[id].gbifAcceptedTaxonID
            if (!resourceTaxonNames[gbif] || resourceTaxa[id].taxonomicStatus === 'accepted') {
                resourceTaxonNames[gbif] = resourceTaxa[id].scientificName
            }
        }

        const matching = []
        const missing = []

        for (const taxon of checklist) {
            const matched = DATA.gbif[taxon.name] && DATA.gbif[taxon.name].some(id => id.startsWith(result._resource.id))
            if (matched) {
                matching.push(taxon)
            } else {
                missing.push(taxon)
            }
        }

        document.getElementById('species_count').textContent = (result.species_ratio * checklist.length).toFixed(0)
        document.getElementById('species_total').textContent = checklist.length
        document.getElementById('species_ratio').replaceChildren(makePieChart(result.species_ratio))
        document.getElementById('observation_ratio').replaceChildren(makePieChart(result.observation_ratio))

        const $matching = document.getElementById('matching_taxa')
        empty($matching)

        for (const taxon of matching) {
            const $taxon = document.createElement('li')
            const $taxonLink = document.createElement('a')
            $taxonLink.setAttribute('href', `https://gbif.org/species/${taxon.name}`)
            $taxonLink.textContent = taxon.displayName || resourceTaxonNames[taxon.name] || taxon.name
            $taxon.appendChild($taxonLink)
            $matching.appendChild($taxon)
        }

        const $missing = document.getElementById('missing_taxa')
        empty($missing)

        for (const taxon of missing) {
            const $taxon = document.createElement('li')
            const $taxonLink = document.createElement('a')
            $taxonLink.setAttribute('href', `https://gbif.org/species/${taxon.name}`)
            $taxonLink.textContent = taxon.displayName || taxon.name
            $taxon.appendChild($taxonLink)
            $missing.appendChild($taxon)
        }

        const $dialog = $missing.closest('dialog')
        $dialog.showModal()
    }

    const DATA = {}
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

    makeInputControl('taxon', 'Taxon', getTaxonSuggestions)
    makeInputControl('checklist-catalog', 'Resource', getResourceSuggestions)

    async function loadData () {
        DATA.catalog = await indexCsv('/assets/data/catalog.csv', 'id')
        DATA.resources = await loadKeys(),
        DATA.gbif = await fetch('/assets/data/resources/gbif.index.json').then(response => response.json())
        DATA.places = await fetch('./data/places.json').then(response => response.json())
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has('taxon') && params.has('location')) {
        document.getElementById('results_message').textContent = 'Loading...'

        document.getElementById('taxon').value = params.get('taxon')
        document.getElementById('location').value = params.get('location')
        document.getElementById('checklist_' + (params.get('checklist') || 'search')).checked = true
        document.getElementById('checklist-catalog').value = params.get('checklist-catalog')

        const taxon = await getTaxon(params.get('taxon'))
        document.getElementById('search_taxon').value = taxon.scientificName

        await loadData()

        if (params.has('checklist-catalog') && params.get('checklist-catalog')) {
            const work = DATA.catalog[params.get('checklist-catalog').split(':')[0]]
            document.getElementById('search_checklist-catalog').value = work.title
        }

        const [results, checklist] = await getResults(taxon, params)

        for (const record of results) {
            if ('parent_proximity' in record) {
                record._score = record.parent_proximity
            } else {
                record._score = 1
            }

            if ('species_ratio' in record) {
                const offset = 0.5
                record._score *= offset + (record.species_ratio * (1 - offset))
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

            if ('parent_proximity' in record && (record.complete === 'FALSE' || record.taxon_scope)) {
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
        }

        results.sort((a, b) => b._score - a._score)

        const $results = document.getElementById('results')
        empty($results)
        for (const result of results) {
            if (result._score === 0) {
                continue
            }

            const $result = document.createElement('div')
            $result.setAttribute('class', 'result')
            $result.addEventListener('click', event => {
                if (event.target.tagName !== 'A') {
                    window.open(`/catalog/detail?id=${result.id}`, '_blank').focus()
                }
            })

            // COLUMN 1
            const $idColumn = document.createElement('div')

            const $idLink = document.createElement('a')
            $idLink.setAttribute('target', 'detail')
            $idLink.setAttribute('href', `/catalog/detail?id=${result.id}`)
            $idLink.textContent = result.id
            $idColumn.appendChild($idLink)

            const $keyTypes = document.createElement('div')
            $keyTypes.innerHTML = result.key_type.split('; ').map(value => octicons[value] || value).join(' ')
            $idColumn.appendChild($keyTypes)

            $result.appendChild($idColumn)

            // COLUMN 2
            const $titleColumn = document.createElement('div')

            const $title = document.createElement('h3')
            $title.innerHTML = octicons[result.entry_type] || ''
            $title.append(' ' + result.title)
            if (result.date) {
                const $year = document.createElement('span')
                $year.setAttribute('style', 'color: #484b3e;')
                $year.textContent = `(${result.date.replace(/-[^\/]+/g, '')})`
                $title.append(' ', $year)
            }
            $titleColumn.appendChild($title)

            const fulltext = result.fulltext_url || result.archive_url
            if (fulltext) {
                const $fulltext = document.createElement('p')

                $fulltext.setAttribute('style', 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')
                $fulltext.innerHTML = octicons.available

                const $fulltextLink = document.createElement('a')
                $fulltextLink.setAttribute('target', '_blank')
                $fulltextLink.setAttribute('href', fulltext)
                $fulltextLink.textContent = fulltext
                $fulltext.append(' ', $fulltextLink)

                $titleColumn.appendChild($fulltext)
            }

            const $info = document.createElement('p')
            {
                const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
                const $language = document.createElement('b')
                $language.textContent = 'Language'
                $info.append($language, ' ', result.language.split('; ').map(language => languageNames.of(language)).join(', '))
            }
            if (result.scope && result.scope.length) {
                $info.append(document.createElement('br'))

                const $scope = document.createElement('b')
                $scope.textContent = 'Scope'
                $info.append($scope, ' ', result.scope.split('; ').join(', '))
            }
            $titleColumn.appendChild($info)

            $result.appendChild($titleColumn)

            // COLUMN 3
            const $coverageColumn = document.createElement('div')
            if (!isNaN(result.species_ratio)) {
                const $coverage = document.createElement('div')
                $coverage.appendChild(makePieChart(result.species_ratio))
                $coverage.addEventListener('click', event => {
                    event.stopPropagation()
                    openCoverageDialog(result, checklist)
                })
                $coverageColumn.appendChild($coverage)
            }
            $result.appendChild($coverageColumn)

            $results.appendChild($result)
        }
    } else {
        await loadData()
    }
})()
