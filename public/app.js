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

        let controller
        $searchInput.addEventListener('input', async function () {
            if (controller && !controller.aborted) {
                controller.abort()
            }

            controller = new AbortController()
            const results = await getSuggestions($searchInput.value, controller.signal).catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return null
                } else {
                    throw error
                }
            })

            if (results == null) {
                return
            }

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

    async function fetchJson (...args) {
        return fetch(...args).then(response => response.json())
    }

    async function getTaxonSuggestions (query, signal) {
        const q = encodeURIComponent(query)
        const results = await fetchJson(`https://api.gbif.org/v1/species/suggest?q=${q}&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`, { signal })
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

    async function getGbifDatasetSuggestions (query, signal) {
        const q = encodeURIComponent(query)
        const results = await fetchJson(`https://api.gbif.org/v1/dataset/suggest?q=${q}&type=CHECKLIST`, { signal })
        return results.slice(0, 5).map(function (result) {
            const $result = new DocumentFragment()

            const $rank = document.createElement('span')
            $rank.textContent = result.type.toLowerCase()
            $rank.setAttribute('class', 'search-taxon-rank')
            $result.appendChild($rank)

            {
                const $main = document.createElement('span')
                $main.setAttribute('class', 'search-taxon-main')

                const $full = document.createElement('span')
                $full.setAttribute('class', 'search-taxon')
                $main.appendChild($full)

                const $name = document.createElement('span')
                $name.textContent = result.title
                $name.setAttribute('class', 'search-taxon-name')
                $full.prepend($name)

                $result.append($main)
            }
            {
                const $sub = document.createElement('span')
                $sub.textContent = result.key
                $sub.setAttribute('class', 'search-taxon-sub')
                $result.append($sub)
            }

            return { value: result.key, displayValue: result.title, $result }
        })
    }

    // From https://github.com/inaturalist/inaturalist/blob/b106ee49c1194f369d646507cb72ebe3fbc366b5/app/models/place.rb#L113
    // Licensed MIT
    const INAT_PLACE_TYPES = {
        '0': 'Undefined',
        '1': 'Building',
        '2': 'Street Segment',
        '3': 'Nearby Building',
        '5': 'Intersection',
        '6': 'Street',
        '7': 'Town',
        '8': 'State',
        '9': 'County',
        '10': 'Local Administrative Area',
        '11': 'Postal Code',
        '12': 'Country',
        '13': 'Island',
        '14': 'Airport',
        '15': 'Drainage',
        '16': 'Land Feature',
        '17': 'Miscellaneous',
        '18': 'Nationality',
        '19': 'Supername',
        '20': 'Point of Interest',
        '21': 'Region',
        '22': 'Suburb',
        '23': 'Sports Team',
        '24': 'Colloquial',
        '25': 'Zone',
        '26': 'Historical State',
        '27': 'Historical County',
        '29': 'Continent',
        '31': 'Time Zone',
        '32': 'Nearby Intersection',
        '33': 'Estate',
        '35': 'Historical Town',
        '36': 'Aggregate',
        '100': 'Open Space',
        '101': 'Territory',
        '102': 'District',
        '103': 'Province',
        '1000': 'Municipality',
        '1001': 'Parish',
        '1002': 'Department Segment',
        '1003': 'City Building',
        '1004': 'Commune',
        '1005': 'Governorate',
        '1006': 'Prefecture',
        '1007': 'Canton',
        '1008': 'Republic',
        '1009': 'Division',
        '1010': 'Subdivision',
        '1011': 'Village block',
        '1012': 'Sum',
        '1013': 'Unknown',
        '1014': 'Shire',
        '1015': 'Prefecture City',
        '1016': 'Regency',
        '1017': 'Constituency',
        '1018': 'Local Authority',
        '1019': 'Poblacion',
        '1020': 'Delegation'
    }

    const INAT_PLACE_NAMES = {}
    async function cachePlaceNames (ids) {
        const unknown = new Set()
        const promises = new Set()

        for (const id of ids) {
            if (INAT_PLACE_NAMES[id] instanceof Promise) {
                promises.add(INAT_PLACE_NAMES[id])
            } else if (!INAT_PLACE_NAMES[id]) {
                unknown.add(id)
            }
        }

        await Promise.all([...promises])

        if (!unknown.size) {
            return
        }

        const request = fetchJson(`https://api.inaturalist.org/v1/places/${[...unknown].join(',')}`)
        for (const id of unknown) {
            unknown[id] = request
        }

        const { results } = await request
        for (const result of results) {
            INAT_PLACE_NAMES[result.id] = result.name
        }
    }

    async function getLocationSuggestions (query, signal) {
        if (query === '') {
            return []
        }

        if (query.match(/^-?[0-9.]+,\s*-?[0-9.]+$/)) {
            const [lat, long] = query.split(/,\s*/)

            const $result = new DocumentFragment()

            const $rank = document.createElement('span')
            $rank.textContent = 'coordinates'
            $rank.setAttribute('class', 'search-taxon-rank')
            $result.appendChild($rank)

            {
                const $main = document.createElement('span')
                $main.setAttribute('class', 'search-taxon-main')
                $result.append($main)

                const $full = document.createElement('span')
                $full.setAttribute('class', 'search-taxon')
                $main.appendChild($full)

                const $lat = document.createElement('span')
                $lat.textContent = lat
                $lat.setAttribute('class', 'search-taxon-name')
                $full.append($lat, ' N')

                const $long = document.createElement('span')
                $long.textContent = long
                $long.setAttribute('class', 'search-taxon-name')
                $full.append(', ', $long, ' E')
            }

            return [
                {
                    value: [lat, long],
                    displayValue: query,
                    $result
                }
            ]
        }

        const q = encodeURIComponent(query)
        const { results } = await fetchJson(`https://api.inaturalist.org/v1/places/autocomplete?q=${q}`, { signal })
        const suggestions = results.slice(0, 5)

        await cachePlaceNames(suggestions.flatMap(result => result.ancestor_place_ids || []))

        return suggestions.map(function (result) {
            const $result = new DocumentFragment()

            const $rank = document.createElement('span')
            $rank.textContent = INAT_PLACE_TYPES[result.place_type]
            $rank.setAttribute('class', 'search-taxon-rank')
            $result.appendChild($rank)

            {
                const $main = document.createElement('span')
                $main.setAttribute('class', 'search-taxon-main')

                const $full = document.createElement('span')
                $full.setAttribute('class', 'search-taxon')
                $main.appendChild($full)

                const $name = document.createElement('span')
                $name.setAttribute('class', 'search-taxon-name')

                if (result.display_name.startsWith(result.name)) {
                    $name.textContent = result.name
                    $full.append($name, result.display_name.slice(result.name.length))
                } else {
                    $name.textContent = result.display_name
                    $full.append($name)
                }

                $result.append($main)
            }
            if (result.ancestor_place_ids) {
                const $sub = document.createElement('span')
                const places = result.ancestor_place_ids.map(id => INAT_PLACE_NAMES[id])
                $sub.textContent = places.join(' > ')
                $sub.setAttribute('class', 'search-taxon-sub')
                $result.append($sub)
            }

            return {
                value: result.location,
                displayValue: result.display_name,
                $result
            }
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
        return fetchJson(`https://api.gbif.org/v1/species/${query}`)
    }

    function getTaxonParents (taxon) {
        return RANKS.filter(rank => taxon[rank]).map(rank => ({
            name: taxon[rank],
            gbif: taxon[rank + 'Key']
        }))
    }

    async function getPlaces (query) {
        const [lat, long] = query.split(/,\s*/g)
        const results = await fetchJson(`https://api.inaturalist.org/v1/places/nearby?nelat=${lat}&nelng=${long}&swlat=${lat}&swlng=${long}`)
        return results.results.standard
    }

    async function getCountryCode (id) {
        const query = encodeURIComponent(`SELECT*WHERE{"${id}"^wdt:P7471/wdt:P131*/wdt:P297?c}`)
        const results = await fetchJson('https://query.wikidata.org/sparql?format=json&query=' + query)
        return results.results.bindings[0].c.value
    }

    async function getOccurrencesBySpecies (taxon, countryCode) {
        const baseUrl = `https://api.gbif.org/v1/occurrence/search?facet=speciesKey&country=${countryCode.toUpperCase()}&taxon_key=${taxon}&year=0,9999&occurrence_status=present&limit=0`

        const species = []
        const pageSize = 100
        let offset = 0
        while (true) {
            const url = `${baseUrl}&facetLimit=${pageSize}&facetOffset=${offset}`
            const response = await fetchJson(url).then(response => response.facets[0].counts)
            species.push(...response)
            if (response.length < pageSize) {
                return species
            } else {
                offset += pageSize
            }
        }
    }

    async function getSpeciesByDataset (taxon, dataset) {
        const { results } = await fetchJson(`https://api.gbif.org/v1/species/${taxon}/related?datasetKey=${dataset}`)
        if (!results.length) {
            return []
        }

        const datasetTaxon = results[0].key
        const baseUrl = `https://api.gbif.org/v1/species/search?highertaxonKey=${datasetTaxon}&datasetKey=${dataset}&rank=SPECIES&status=ACCEPTED`

        const species = []
        const pageSize = 100
        let offset = 0
        while (true) {
            const url = `${baseUrl}&limit=${pageSize}&offset=${offset}`
            const response = await fetchJson(url)

            species.push(...response.results.map(result => ({
                name: result.nubKey,
                displayName: result.scientificName,
                count: 0
            })))

            if (response.endOfRecords) {
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
            const response = await fetchJson(url)

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

        function countSpeciesForResource (resourceId, species, count) {
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

            // Count species for parent entries, in case do not already have
            // a species list.
            const workId = resourceId.match(/^B\d+/)[0]
            if (DATA.catalog[workId].part_of) {
                const parentWorkIds = DATA.catalog[workId].part_of.split('; ')
                for (const parentWorkId of parentWorkIds) {
                    if (!DATA.resources[parentWorkId + ':1']) {
                        countSpeciesForResourceParent(parentWorkId, species, count)
                    }
                }
            }
        }

        function countSpeciesForResourceParent (parentWorkId, species, count) {
            const parentResourceId = parentWorkId + ':0'

            // Insert virtual resource into entity index
            if (!DATA.resources[parentResourceId]) {
                DATA.resources[parentResourceId] = { id: parentResourceId, taxa: [] }
            }

            // Insert virtual resource into GBIF index
            if (!DATA.gbif[species].includes(parentResourceId)) {
                DATA.gbif[species].push(parentResourceId)
            }

            countSpeciesForResource(parentResourceId, species, count)
        }

        for (const { name: species, count } of checklist) {
            if (species in DATA.gbif) {
                for (const id of DATA.gbif[species]) {
                    const resourceId = id.match(/^B\d+:\d+/)[0]
                    countSpeciesForResource(resourceId, species, count)
                }
            }
        }

        return resources
    }

    function isTaxonParent (parentName, ancestry) {
        const taxon = DATA.taxa[parentName]
        const children = taxon.children_gbif ? taxon.children_gbif.split('; ') : undefined

        for (let i = 0; i < ancestry.length; i++) {
            const parentTaxon = ancestry[ancestry.length - i - 1]
            if (parentTaxon.gbif) {
                const parentGbif = parentTaxon.gbif.toString()
                if (taxon.gbif === parentGbif) {
                    return i
                } else if (taxon.children_gbif && children.includes(parentGbif.toString())) {
                    return i + 0.5
                }
            } else if (parentTaxon.name === taxon.name) {
                return i
            }
        }

        return -1
    }

    async function getResults (taxon, params) {
        // Get parent taxa
        const parentTaxa = getTaxonParents(taxon)
        if (taxon.key === 0) {
            parentTaxa.push({ name: 'Biota' })
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
        } else if (params.get('checklist') === 'gbif_dataset') {
            const datasetKey = params.get('checklist-gbif-dataset')
            checklist = await getSpeciesByDataset(taxon.key, datasetKey)
        } else {
            checklist = []
        }

        console.log(parentTaxa, places, checklist)

        const results = []

        // Use the GBIF ID-based checklist and the GBIF index to keys to find keys
        const matchingResources = await findGbifMatches(checklist)
        const seenCatalogWorks = new Set()
        for (const resourceId in matchingResources) {
            const catalogId = resourceId.replace(/:\d+$/, '')
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
            let closestTaxon = Infinity
            for (const taxonName of record.taxon.split('; ')) {
                const distance = isTaxonParent(taxonName, parentTaxa)
                if (distance !== -1 && distance < closestTaxon) {
                    closestTaxon = distance
                }
            }
            if (isFinite(closestTaxon)) {
                record.parent_proximity = (parentTaxa.length - closestTaxon) / parentTaxa.length
            } else {
                // Taxa not applicable
                continue
            }

            if (!record.region.split('; ').some(place => places.includes(place))) {
                // Region not applicable
                continue
            }

            results.push(record)
        }

        return [results, checklist]
    }

    function scoreResult (record, taxon, params) {
        record._score_relevance = 1
        record._score_usability = 1
        record._score_recency = 1

        if ('parent_proximity' in record) {
            const offset = 0.5
            record._score_relevance *= offset + (record.parent_proximity * (1 - offset))
        }

        if ('species_ratio' in record) {
            const offset = 0.5
            record._score_relevance *= offset + (record.species_ratio * (1 - offset))
        }

        if (record.target_taxa) {
            let every = true
            let some = false
            for (const target of record.target_taxa.split('; ')) {
                const match = compareRanks(taxon.rank.toLowerCase(), target) < 0
                every = every && match
                some = some || match
            }
            record._score_relevance *= every ? 1 : some ? 0.9 : 0;
        }

        if ('parent_proximity' in record && (record.complete === 'FALSE' || record.taxon_scope)) {
            record._score_usability *= 0.9
        }

        if (record.key_type) {
            const types = record.key_type.split('; ')
            if (types.includes('key') || types.includes('matrix')) {
                // record._score_usability *= 1
            } else if (types.includes('reference')) {
                record._score_usability *= 0.9
            } else if (types.includes('gallery')) {
                record._score_usability *= 0.8
            } else {
                record._score_usability *= 0.7
            }
        }

        if (!record.fulltext_url && !record.archive_url) {
            record._score_usability *= 0.9
        }

        if (record.date) {
            const year = parseInt(record.date.split('-')[0])

            if (!isNaN(year)) {
                // TODO date of observation
                const currentYear = new Date().getFullYear()
                const firstYear = Math.min(year, 1850)

                const offset = 0.5
                record._score_recency *= offset + (1 - offset) * (year - firstYear) / (currentYear - firstYear)
            }
        }

        record._score = record._score_relevance * record._score_usability * record._score_recency
    }

    function makeResult (result, checklist) {
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
            $year.textContent = `(${result.date.replace(/-[^\/]+/g, '').replace('/', '\u2013')})`
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
            const $language = document.createElement('b')
            $language.textContent = 'Language'
            $info.append($language, ' ', result.language.split('; ').map(language => LANGUAGE_NAMES.of(language)).join(', '))
        }
        if (result.scope && result.scope.length) {
            $info.append(document.createElement('br'))

            const $scope = document.createElement('b')
            $scope.textContent = 'Scope'
            $info.append($scope, ' ', result.scope.split('; ').join(', '))
        }
        if (result._versions && result._versions.length > 1) {
            $info.append(document.createElement('br'), document.createElement('br'))

            const $versions = document.createElement('a')
            $versions.setAttribute('href', '#')
            $versions.textContent = `View all ${result._versions.length} editions/versions`
            $versions.addEventListener('click', event => {
                event.stopPropagation()
                openVersionsDialog(result, checklist)
            })
            $info.append($versions)
        }
        $titleColumn.appendChild($info)

        $result.appendChild($titleColumn)

        // COLUMN 3
        const $coverageColumn = document.createElement('div')
        const $coverage = document.createElement('div')
        {
            const parts = [
                { letter: 'r', key: '_score_relevance', color: result._resource ? '#000000' : '#989d89' },
                { letter: 'e', key: '_score_usability', color: '#989d89' },
                { letter: 't', key: '_score_recency', color: '#989d89' },
            ]
            const totalWidth = 60
            const textWidth = 16
            const partHeight = 14

            const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            $svg.setAttribute('width', totalWidth)
            $svg.setAttribute('height', partHeight * parts.length)
            $svg.setAttribute('viewbox', `0 0 ${totalWidth} ${partHeight * parts.length}`)

            for (let i = 0; i < parts.length; i++) {
                const { letter, key, color } = parts[i]
                const $g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
                $g.setAttribute('transform', `translate(0 ${i * partHeight})`)
                const $text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
                $text.setAttribute('dx', textWidth / 2)
                $text.setAttribute('dy', '25%')
                $text.setAttribute('font-size', '12')
                $text.setAttribute('font-weight', 'bold')
                $text.setAttribute('text-anchor', 'middle')
                $text.textContent = letter
                const $line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
                $line.setAttribute('x1', textWidth)
                $line.setAttribute('x2', textWidth + result[key] * (totalWidth - textWidth))
                $line.setAttribute('y1', partHeight / 2)
                $line.setAttribute('y2', partHeight / 2)
                $line.setAttribute('stroke', color)
                $line.setAttribute('stroke-width', 3)
                const $baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line')
                $baseline.setAttribute('x1', textWidth + result[key] * (totalWidth - textWidth))
                $baseline.setAttribute('x2', totalWidth)
                $baseline.setAttribute('y1', partHeight / 2)
                $baseline.setAttribute('y2', partHeight / 2)
                $baseline.setAttribute('stroke', '#989d89')
                $g.append($text, $line, $baseline)
                $svg.append($g)
            }
            $coverage.append($svg)
        }
        $coverage.addEventListener('click', event => {
            event.stopPropagation()
            openCoverageDialog(result, checklist)
        })
        if (!isNaN(result.species_ratio) && result._resource && result._resource.flags) {
            $coverage.append('*')
        }
        $coverageColumn.appendChild($coverage)
        $result.appendChild($coverageColumn)

        return $result
    }

    function render (sortKey) {
        const results = DATA.results.slice()
        results.sort((a, b) => (b[sortKey] - a[sortKey]) || (b._score - a._score))

        // Group
        const groupedResults = {}
        for (const result of results) {
            let versionId = result.version_of || result.id
            if (result._resource) {
                if (result._resource.catalog && result._resource.catalog.version_of) {
                    versionId = result._resource.catalog.version_of
                } else {
                    const resourceId = result._resource.id.split(':').pop()
                    versionId += ':' + resourceId
                }
            } else {
                versionId += ':1'
            }

            if (groupedResults[versionId]) {
                groupedResults[versionId]._versions.push(result)
            } else {
                groupedResults[versionId] = {
                    ...result,
                    _versions: [result]
                }
            }
        }

        // Render
        const $results = document.getElementById('results')
        empty($results)
        for (const result of Object.values(groupedResults)) {
            $results.appendChild(result._element)
        }
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
        for (const part of ['relevance', 'usability', 'recency']) {
            const $td = document.getElementById(`score_${part}`)
            empty($td)
            $td.append(makePieChart(result[`_score_${part}`]))
        }

        if (result._resource) {
            const resourceTaxonNames = {}

            if (!result._resource.id.endsWith(':0')) {
                const resourceTaxa = await indexCsv(`/assets/data/resources/dwc/${result._resource.id.split(':').join('-')}.csv`, 'scientificNameID')
                for (const id in resourceTaxa) {
                    const gbif = resourceTaxa[id].gbifAcceptedTaxonID
                    if (!resourceTaxonNames[gbif] || resourceTaxa[id].taxonomicStatus === 'accepted') {
                        resourceTaxonNames[gbif] = resourceTaxa[id].scientificName
                    }
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

            if (isNaN(result.observation_ratio)) {
                document.getElementById('observation_ratio_text').setAttribute('style', 'display: none;')
            } else {
                document.getElementById('observation_ratio_text').removeAttribute('style')
            }

            const $flags = document.getElementById('species_flags')
            empty($flags)
            if (result._resource.flags) {
                for (const flag of result._resource.flags) {
                    const $p = document.createElement('p')
                    $p.classList.add('alert')
                    $p.textContent = flagLabels[flag]
                    const $span = document.createElement('span')
                    $span.textContent = `(${flag})`
                    $span.setAttribute('style', 'color: grey;')
                    $p.append('. ', $span)
                    $flags.append($p)
                }
            }

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

            document.getElementById('dialog_taxonomic_coverage').style.display = 'block'
        } else {
            document.getElementById('dialog_taxonomic_coverage').style.display = 'none'
        }

        document.getElementById('dialog_result_score').showModal()
    }

    function openVersionsDialog (result, checklist) {
        const $versions = document.getElementById('results_versions')
        empty($versions)

        for (const version of result._versions) {
            $versions.appendChild(version._element)
        }

        const $dialog = $versions.closest('dialog')
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
    const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' })

    function compareRanks (a, b) {
        return RANKS.indexOf(a) - RANKS.indexOf(b)
    }

    makeInputControl('taxon', 'Taxon', getTaxonSuggestions)
    makeInputControl('location', 'Location', getLocationSuggestions)
    makeInputControl('checklist-gbif-dataset', 'GBIF dataset', getGbifDatasetSuggestions)
    makeInputControl('checklist-catalog', 'Resource', getResourceSuggestions)

    document.querySelector('#input_wrapper form').addEventListener('formdata', function (event) {
        const fields = [...event.formData]
        for (const [key, value] of fields) {
            if (value === '') {
                event.formData.delete(key)
            }
        }
    })

    document.getElementById('results_sort').addEventListener('change', function (event) {
        render(event.target.value)
    })

    async function loadData () {
        const [catalog, resources, gbif, places, taxa] = await Promise.all([
            indexCsv('/assets/data/catalog.csv', 'id'),
            loadKeys(),
            fetchJson('/assets/data/resources/gbif.index.json'),
            fetchJson('./data/places.json'),
            indexCsv('/assets/data/taxa.csv', 'name')
        ])
        DATA.catalog = catalog
        DATA.resources = resources
        DATA.gbif = gbif
        DATA.places = places
        DATA.taxa = taxa
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has('taxon') && params.has('location')) {
        document.getElementById('results_message').textContent = 'Loading...'

        document.getElementById('taxon').value = params.get('taxon')
        document.getElementById('location').value = params.get('location')
        document.getElementById('checklist_' + (params.get('checklist') || 'search')).checked = true
        document.getElementById('checklist-gbif-dataset').value = params.get('checklist-gbif-dataset')
        document.getElementById('checklist-catalog').value = params.get('checklist-catalog')

        const taxon = await getTaxon(params.get('taxon'))
        document.getElementById('search_taxon').value = taxon.scientificName
        document.getElementById('search_location').value = params.get('location')

        await loadData()

        if (params.has('checklist-gbif-dataset') && params.get('checklist-gbif-dataset')) {
            const key = params.get('checklist-gbif-dataset')
            const dataset = await fetchJson(`https://api.gbif.org/v1/dataset/${key}`)
            document.getElementById('search_checklist-gbif-dataset').value = dataset.title
        }

        if (params.has('checklist-catalog') && params.get('checklist-catalog')) {
            const work = DATA.catalog[params.get('checklist-catalog').split(':')[0]]
            document.getElementById('search_checklist-catalog').value = work.title
        }

        const [results, checklist] = await getResults(taxon, params)

        // Sort and render
        for (const result of results) {
            scoreResult(result, taxon, params)
            result._element = makeResult(result, checklist)
        }
        DATA.results = results.filter(result => result._score > 0)

        render('_score')
    } else {
        await loadData()
    }
})()
