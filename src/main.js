/*!
 * Main script file for project-specific elements.
 * Contains the logic to communicate with the Terminology Server.
 *
 * Biomedical Research Center - Clinical Research and Informatics Unit
 * University College London Hospital
 * 2020
 */

const BASE_API_URI = "https://ontoserver.dataproducts.nhs.uk/fhir/";
const context = {
    latestSearchToken: null,
    codeSystem: null,
    valueSet: null,
    concept: null,
    conceptSearch: {
        count: 100,
        offset: 0,
		activeOnly: true,
		includeDesignations: true
    },
    eclSearch: {
        count: 100,
        offset: 0,
		activeOnly: true,
		includeDesignations: true
    }
};

/**
 * Send a query to the API and return a `Promise` that handles the response.
 *
 * @param operation
 * @param params
 * @returns {Promise}
 */
 function query(operation, params) {
    return new Promise((resolve, reject) => {
        const queryData = {
            url: BASE_API_URI + operation,
            method: "GET",
            data: params,
            contentType: "text/plain",
            accepts: "text/fhir+json",
            dataType: "json",
            success: (data, textStatus, jqXHR) => {
                resolve(data);
            },
            error: (jqXHR, textStatus, errorThrown) => {
                if (jqXHR.responseJSON) reject(new Error(jqXHR.responseText));
                else reject(new Error(jqXHR.status));
            },
        };
        console.debug(queryData);
        $.ajax(queryData);
    });
}


/**
 * Returns the contents of the attribute `entry` after a query to a FHIR resource
 * (e.g. CodeSystem or ValueSet).
 *
 * @param operation
 * @param params
 * @returns {Promise}
 */
function queryFHIRResource(operation, params) {
     return query(operation, params).then((response) => {
         return { results: response.entry || [] };
     });
}


/**
 * Performs multiple queries providing as a result the merge of individual results.
 *
 * Each query will be performed with the arguments given (an element in `queriesArguments`).
 *
 * The final result list is the combination of individual results, with each element appearing
 * only once. To remove duplicates between query results, the value of `resource.id` is used
 * (the ID of an item in Ontoserver identifies it uniquely).
 *
 * To match the response of `query`, the returned value is also `Promise` and the success
 * result is an object containing an attribute `entry`.
 *
 * @param queriesArguments: List of pairs [operation, params] for each individual query.
 * @returns {Promise}
 */
function mergedFHIRResourceQueries(queriesArguments) {
    return new Promise((resolve, reject) => {
        // Launch every query at the same time
        const queries = [];
        queriesArguments.forEach((pair) => {
            queries.push(queryFHIRResource(pair[0], pair[1]));
        });

        const uniqueResults = [];
        const uniqueIds = [];

        // This recursive function will process results until there is no more queries,
        // at which point it resolves the promise and returns.
        const processResults = function () {
            if (queries.length <= 0) {
                resolve({ results: uniqueResults });
            }
            else {
                const lastQuery = queries.pop();
                lastQuery.then((response) => {
                    response.results.forEach((item) => {
                        if (! uniqueIds.includes(item.resource.id)) {
                            uniqueIds.push(item.resource.id);
                            uniqueResults.push(item);
                        }
                    });
                    processResults();
                }).catch((error) => reject(error));
            }
        };

        // Process all results
        processResults();
    });
}


/**
 * Subscribe to changes on a field and execute a function when the value changes.
 *
 * @param field: A text field that can be written on.
 * @param callback: A function that receives as parameters a unique token identifying
 * the latest event (to avoid processing old queries) and the trigger field.
 * @param minLength: Minimal length the field bust have to trigger a query. Default is 2.
 */
function subscribe(field, callback, minLength) {
    // Search while writing in the field
    // https://stackoverflow.com/a/14042239
    // Chrome Fix (Use keyup over keypress to detect backspace)
    // let timeoutRef = null;
    // field.on("keyup keypress paste", function(evt) {
    //     if (evt.keyCode === 13) { evt.preventDefault(); return; }
    //     if (evt.type === "keyup" && evt.keyCode !== 8 && evt.keyCode !== 46) { return; }
    //     if (timeoutRef) { clearTimeout(timeoutRef); }
    //     timeoutRef = setTimeout(() => {
    //         const token = + new Date();
    //         context.latestSearchToken = token;
    //         callback(token, field);
    //     }, 400);
    // });
    if (minLength === undefined) { minLength = 2; }
    field.on("change keypress", (evt) => {
        if (evt.type === "keypress" && evt.keyCode !== 13) { return; }
        if (evt.target.value.trim().length < minLength) { return; }
        const token = + new Date();
        context.latestSearchToken = token;
        callback(token, $(evt.target));
    });
}


/**
 * Helper function to set the value of a MaterializeCSS input text and
 * update the style accordingly.
 *
 * @param field
 * @param value
 */
function setVal(field, value) {
    const label = $(`label[for=${field[0].id}]`);
    field.val(value);
    if (value) { label.addClass("active"); }
    else { label.removeClass("active"); }
}


/**
 * Generates and returns DOM element to display pages.
 *
 * @param current
 * @param total
 * @param pageCallback
 * @returns {*|jQuery.fn.init|jQuery|HTMLElement}
 */
function getPagination(current, total, pageCallback) {
    const pages = [];
    const container = $("<ul class='pagination'></ul>")
    const prev = $("<li><a href='#!'><i class='material-icons'>chevron_left</i></a></li>");
    const next = $("<li><a href='#!'><i class='material-icons'>chevron_right</i></a></li>");
    for (let i = 1; i <= total; i++) {
        const page = $(`<li><a href='#!'>${i}</a></li>`).click((evt) => {
            evt.preventDefault();
            $(evt.target).parent("li").addClass("active disabled")
                .parent("ul.pagination").find(".active").removeClass("active disabled");
            pageCallback(i);
        });
        pages.push(page);
        container.append(page);
    }
    container.prepend(prev);
    container.append(next);

    pages[current - 1].addClass("active disabled");
    pages[current - 1].click((evt) => { evt.preventDefault(); });

    if (current === 1) {
        prev.addClass("disabled");
        prev.click((evt) => { evt.preventDefault(); });
    }
    else {
        prev.click((evt) => {
            evt.preventDefault();
            $(evt.target).parents("ul.pagination").find(`li:nth-child(${current})`).click();
        });
    }

    if (current === total) {
        next.addClass("disabled");
        next.click((evt) => { evt.preventDefault(); });
    }
    else {
        next.click((evt) => {
            evt.preventDefault();
            $(evt.target).parents("ul.pagination").find(`li:nth-child(${current + 2})`).click();
        });
    }

    return container;
}


/**
 * Generic function to handle results of a search when the linked field value changes.
 *
 * @param searchToken
 * @param field
 * @param resultsContainer
 * @param loadingIcon
 * @param apiQueryBuilder
 * @param resultItemBuilder
 * @param onSelectItem
 * @param onPageChange
 */
function handleSearchField(searchToken, field, resultsContainer, loadingIcon,
                           apiQueryBuilder,
                           resultItemBuilder, onSelectItem,
                           onPageChange) {
    const searchValue = field.val();
    const targetError = $("#error-container");

    loadingIcon.addClass("rotation");
    loadingIcon.removeClass("paused");

    apiQueryBuilder(searchValue).then(
        (response) => {
            if (context.latestSearchToken !== searchToken) { return; }

            console.debug(response);
            const results = response.results;
            targetError.hide(200);
            if (results.length > 0) {
                resultsContainer.html("");

                // Display page information (if given)
                if (response.offset !== undefined) {
                    let pageInfo = `Results ${response.offset + 1} to ${response.offset + results.length}`;
                    if (response.total !== undefined) {
                        pageInfo += ` of ${response.total}`;
                    }
                    resultsContainer.append($("<div></div>").addClass("page-info")).append(
                        pageInfo,
                        getPagination(
                            Math.ceil(response.offset / response.pageSize) + 1,
                            Math.ceil(response.total / response.pageSize),
                            onPageChange
                        )
                    );
                }

                const itemsWrapper = $("<div></div>").addClass("collection");
                results.forEach((item) => {
                    const itemDOM = resultItemBuilder(item);
                    itemDOM.data(item);
                    itemsWrapper.append(itemDOM);
                });
                itemsWrapper.find(".clickable").click((evt) => onSelectItem($(evt.currentTarget).data()));
                resultsContainer.append(itemsWrapper);
            }
            else {
                resultsContainer.html($("<div>No results</div>").addClass("center-align"));
            }
            resultsContainer.show(0);
            loadingIcon.addClass("paused");
        },
        (error) => {
            console.error(error);
            loadingIcon.addClass("paused");
            resultsContainer.html("Error. Please check the console or the error box at the top of the page.");
            resultsContainer.show();
            try {
                const jsonError = JSON.parse(error.message);
                targetError.html(JSON.stringify(jsonError, null, 2));
            }
            catch {
                targetError.html(error.message);
            }
            targetError.show(200);
        }
    );
}


/**
 * Handles querying the API for Code Systems when the linked field changes.
 *
 */
function handleCodeSystem() {
    subscribe($("#code-systems-search"), (searchToken, field) => {
        handleSearchField(
            searchToken,
            field,
            $("#code-systems-results"),
            $("#code-systems-loading"),
            (value) => {
                /*
                 * NOTE: FHIR interprets the characters $ , | \ as special characters that
                 * change the search expression https://www.hl7.org/fhir/search.html#escaping.
                 *
                 * Ontoserver only allows searching in one field at a time (_text and _content are
                 * not implemented), which means we need to chain queries and then mix the results.
                 */
                return mergedFHIRResourceQueries([
                    ["CodeSystem", { "name:contains": value }],
                    ["CodeSystem", { "description:contains": value }],
                    ["CodeSystem", { "url": value }]
                ]);
            },
            (codeSystem) => {
                return $("<div></div>")
                    .addClass("collection-item clickable")
                    .append(
                        $("<div></div>")
                            .html(codeSystem.resource.name)
                            .addClass("name"),
                        $("<div></div>")
                            .html(codeSystem.resource.description)
                            .addClass("description"),
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": codeSystem.resource.url})
                            .addClass("new badge")),
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": codeSystem.resource.id})
                            .addClass("new badge badge-id"))
                    );
            },
            (codeSystem) => {
                console.debug(codeSystem);
                context.codeSystem = codeSystem;
                setVal(field, codeSystem.resource.name);
                field
                    .siblings(".helper-text").html(
                        $("<a></a>")
                            .html(codeSystem.fullUrl)
                            .attr({
                                "href": codeSystem.fullUrl,
                                "target": "_blank"
                            })
                    );
                setVal($("#value-sets-search"), codeSystem.resource.valueSet);
                $("#code-systems-results").hide();
            },
        );
    });
}

/**
 * Handles querying the API for Value Sets when the linked field changes.
 *
 */
function handleValueSet() {
    subscribe($("#value-sets-search"), (searchToken, field) => {
        handleSearchField(
            searchToken,
            field,
            $("#value-sets-results"),
            $("#value-sets-loading"),
            (value) => {
                return mergedFHIRResourceQueries([
                    ["ValueSet", { "name:contains": value }],
                    ["ValueSet", { "description:contains": value }],
                    ["ValueSet", { "url": value }]
                ]);
            },
            (valueSet) => {
                return $("<div></div>")
                    .addClass("collection-item clickable")
                    .append(
                        $("<div></div>")
                            .html(valueSet.resource.name)
                            .addClass("name"),
                        $("<div></div>")
                            .html(valueSet.resource.description)
                            .addClass("description"),
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": valueSet.resource.url})
                            .addClass("new badge")),
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": valueSet.resource.id})
                            .addClass("new badge badge-id"))
                    );
            },
            (valueSet) => {
                console.debug(valueSet);
                context.valueSet = valueSet;
                setVal(field, valueSet.resource.url);
                field
                    .siblings(".helper-text").html(
                        $("<a></a>")
                            .html(valueSet.fullUrl)
                            .attr({
                                "href": valueSet.fullUrl,
                                "target": "_blank"
                            })
                    );
                $("#value-sets-results").hide();
            },
        );
    });
}

/**
 * Handles querying the API for Concepts on the previously selected Value Set.
 *
 */
function handleConcept() {
    /**
     * Executes the logic for a new query, to be called when the search field
     * changes or a different page is requested.
     *
     * @param searchToken
     * @param field
     */
    const search = function(searchToken, field) {
        handleSearchField(
            searchToken,
            field,
            $("#concepts-results"),
            $("#concepts-loading"),
            (value) => {
                return query("ValueSet/$expand",{
                    // "url": context.valueSet.resource.url,
                    url: $("#value-sets-search").val(),
                    filter: value,
                    offset: context.conceptSearch.offset,
                    count: context.conceptSearch.count,
                    activeOnly: context.conceptSearch.activeOnly,
                    includeDesignations: context.conceptSearch.includeDesignations
                }).then((response) => {
                    return {
                        results: response.expansion.contains || [],
                        offset: response.expansion.offset,
                        pageSize: context.conceptSearch.count,
                        total: response.expansion.total
                    };
                });
            },
            (concept) => {
                const conceptDOM = $("<div></div>")
                    .addClass("collection-item")
                    .append(
                        $("<div></div>")
                            .html(concept.display)
                            .addClass("name"),
                        $("<div></div>")
                            .html(concept.code)
                            .addClass("description"),
                        $("<div></div>")
                            .html(() => {
                                const synonyms = $("<div></div>");
                                concept.designation.forEach((desig) => {
                                    synonyms.append($("<div></div>").html(desig.value));
                                });
                                return synonyms.html();
                            })
                            .addClass("synonyms"),
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": concept.system})
                            .addClass("new badge"))
                    );
                if (concept.inactive) {
                    conceptDOM.append(
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": "INACTIVE"})
                            .addClass("new badge badge-id"))
                    );
                }
                return conceptDOM;
            },
            () => {/* Do nothing when a concept is clicked */},
            (page) => {
                // Change offset and trigger search
                context.conceptSearch.offset = context.conceptSearch.count * (page - 1);
                search(searchToken, field);
            }
        );
    };

    subscribe($("#concepts-search"), (searchToken, field) => {
        context.conceptSearch.offset = 0;
        search(searchToken, field);
    });
}

/**
 * Handles querying the API using SNOMED CT - Expression Constraint Language (ECL) filters.
 *
 */
function handleECLFilter() {
    const eclFields = $(".ecl-filter-operator")
        .add($(".ecl-filter-code"))
        .add($(".ecl-filter-label"));
    const eclSearchField = $("#ecl-filters-search");
    const eclAddBtn = $(".ecl-filter-add");

    /**
     * Executes the logic for a new query, to be called when the search field
     * changes or a different page is requested.
     *
     * @param searchToken
     * @param field
     */
    const search = function(searchToken, field) {
        handleSearchField(
            searchToken,
            field,
            $("#ecl-filters-results"),
            $("#ecl-filters-loading"),
            (value) => {
                // Build SNOMED CT URL query
                let url = $("#value-sets-search").val();
                if (! url.endsWith("?fhir_vs")) {
                    console.warn("The ValueSet URL does not end with the parameter \"?fhir_vs\"."
                        + "It was automatically added.");
                    url += "?fhir_vs";
                }
                url += "=ecl/" + value;

                return query("ValueSet/$expand",{
                    url: url,
                    offset: context.eclSearch.offset,
                    count: context.eclSearch.count,
                    activeOnly: context.eclSearch.activeOnly,
                    includeDesignations: context.eclSearch.includeDesignations
                }).then((response) => {
                    // Focus the results
                    $("html,body").animate({scrollTop: $("#ecl-filters-title").offset().top}, 1000);

                    // Return a simplified response
                    return {
                        results: response.expansion.contains || [],
                        offset: response.expansion.offset,
                        pageSize: context.eclSearch.count,
                        total: response.expansion.total,
                    };
                });
            },
            (concept) => {
                // DOM elements to display the concept
				const conceptDOM = $("<div></div>")
                    .addClass("collection-item")
                    .append(
                        $("<div></div>")
                            .html(concept.display)
                            .addClass("name ecl-concept-name"),
                        $("<div></div>")
                            .html(concept.code)
                            .addClass("description ecl-concept-description"),
                        $("<div></div>")
                            .html(() => {
                                const synonyms = $("<div></div>");
                                concept.designation.forEach((desig) => {
                                    synonyms.append($("<div></div>").html(desig.value));
                                });
                                return synonyms.html();
                            })
                            .addClass("synonyms ecl-concept-synonyms"),
                        $("<div></div>")
                            .html($("<span></span>")
                                .attr({"data-badge-caption": concept.system})
                                .addClass("new badge"))
                            .addClass("ecl-concept-system"),
                        $("<div></div>")
                            .html($("<button>Parents</button>")
                                .addClass("btn btn-small white uclh-primary-text")
                                .click(() => {
                                    setFilterFields([{
                                        op: "parentOf",
                                        code: concept.code,
                                        label: concept.display
                                    }]);
                                }))
                            .addClass("ecl-concept-parents-btn"),
                        $("<div></div>")
                            .html($("<button>Children</button>")
                                .addClass("btn btn-small white uclh-primary-text")
                                .click(() => {
                                    setFilterFields([{
                                        op: "childOf",
                                        code: concept.code,
                                        label: concept.display
                                    }]);
                                }))
                            .addClass("ecl-concept-children-btn")
                    );
                if (concept.inactive) {
                    conceptDOM.append(
                        $("<div></div>").html($("<span></span>")
                            .attr({"data-badge-caption": "INACTIVE"})
                            .addClass("new badge badge-id"))
                    );
                }
                return conceptDOM;
            },
            () => {/* Do nothing when a concept is clicked */},
            (page) => {
                // Change offset and trigger search
                context.eclSearch.offset = context.eclSearch.count * (page - 1);
                search(searchToken, field);
            }
        );
    };

    /**
     * Update the field with the search string, which will also trigger a new
     * query to the server.
     *
     * @param evt
     */
    const updateSearchString = (evt) => {
        if (evt && evt.type === "keypress" && evt.keyCode !== 13) { return; }

        // Rebuild the ECL filter
        const shortECL = [];
        const longECL = [];
        $(".ecl-filter-wrapper").each((index, item) => {
            const wrapper = $(item);
            const filter = {
                op: wrapper.find(".ecl-filter-operator").val(),
                opLong: wrapper.find(".ecl-filter-operator > option:selected").attr("data-long-value"),
                code: wrapper.find(".ecl-filter-code").val(),
                label: wrapper.find(".ecl-filter-label").val(),
            };
            // When the operator is "ANY" the other fields must be ignored
            if (filter.opLong === "ANY") {
                shortECL.push(filter.op);
                longECL.push(filter.opLong);
            }
            else if (filter.code) {
                if (filter.label) {
                    shortECL.push(`${filter.op} ${filter.code}|${filter.label}|`);
                    longECL.push(`${filter.opLong} ${filter.code}|${filter.label}|`);
                }
                else {
                    shortECL.push(`${filter.op} ${filter.code}`);
                    longECL.push(`${filter.opLong} ${filter.code}`);
                }
            }
        });
        console.debug(shortECL);
        console.debug(longECL);

        // Display long ECL
        setVal(eclSearchField, shortECL.join(", "));
        eclSearchField.change();
    };

    /**
     * Append a new set of fields to further filter the concepts.
     *
     * @param operator
     * @param code
     * @param label
     */
    const addFilterFields = (operator, code, label) => {
        const lastWrapper = $(".ecl-filter-wrapper:last-child");
        const button = lastWrapper.find(".ecl-filter-add");
        const newWrapper = $("<div class=ecl-filter-wrapper></div>").append(
            $("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-operator").clone()),
            $("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-code").clone()),
            $("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-label").clone()),
            $("<div class=input-field></div>").append(
                button.clone()
                    .html("-")
                    .removeClass()
                    .addClass("btn white uclh-warm-red-text ecl-filter-remove")
                    .click(removeFilterFields),
                button.clone()
                    .click(() => { addFilterFields(); })
            )
        );
        newWrapper.find("input, select").on("change keypress", updateSearchString);

        // Provide initial values if given
        const select = newWrapper.find(".ecl-filter-operator");
        if (operator) {
            select.val(select.find(`option[data-long-value=${operator}]`)[0].value);
        }
        newWrapper.find(".ecl-filter-code").val(code || "");
        newWrapper.find(".ecl-filter-label").val(label || "");

        // Apply DOM changes
        button
            .hide()
            .after($("<div></div>").addClass("ecl-filter-btn-placeholder"));
        newWrapper.insertAfter(lastWrapper);
        $("select").not(".disabled").not(".browser-default").each(function() {
            M.FormSelect.init(this, {});
        });

        // Scroll if the new elements are outside the view
        const docViewTop = $(window).scrollTop();
        const docViewBottom = docViewTop + $(window).height();
        const elemTop = newWrapper.offset().top;
        const elemBottom = elemTop + newWrapper.height();
        if (elemBottom > docViewBottom) {
            $("html,body").animate({scrollTop: docViewTop + (elemBottom - docViewBottom)}, 500);
        }
    };

    /**
     * Remove the filter fields linked to the target button.
     *
     * @param evt
     */
    const removeFilterFields = (evt) => {
        $(evt.target).parents(".ecl-filter-wrapper").remove();
        const lastWrapper = $(".ecl-filter-wrapper:last-child");
        lastWrapper.find(".ecl-filter-add").show();
        lastWrapper.find(".ecl-filter-btn-placeholder").remove();
        updateSearchString();
    };

    /**
     * Set the filter fields to exactly match the given list.
     * Each item in the list must be an object with the attributes:
     * - op: Long name of the operator (e.g. `"childOf"`)
     * - code: SNOMED CT code
     * - label: (Optional) Label corresponding to the `code`.
     *
     * @param filters
     */
    const setFilterFields = (filters) => {
        // Remove all the previous
        $(".ecl-filter-wrapper:not(:last-child)").remove();

        // Set the first filter
        const firstWrapper = $(".ecl-filter-wrapper:last-child");
        const select = firstWrapper.find(".ecl-filter-operator");
        select.val(select.find(`option[data-long-value=${filters[0].op}]`)[0].value);
        M.FormSelect.init(select[0], {});
        firstWrapper.find(".ecl-filter-code").val(filters[0].code || "");
        firstWrapper.find(".ecl-filter-label").val(filters[0].label || "");

        // Add the remaining filters
        for (let i = 1; i < filters.length; i++) {
            addFilterFields(filters[i].op, filters[i].code, filters[i].label);
        }

        // Update search
        updateSearchString();
    }

    eclFields.on("change keypress", updateSearchString);
    eclAddBtn.click(() => { addFilterFields(); });

    subscribe(
        eclSearchField,
        (searchToken, field) => {
            context.eclSearch.offset = 0;
            search(searchToken, field);
        },
        1);
}

/**
 * Configures the navigation menu, to smoothly scroll to the targets.
 */
function handleNavigation() {
    $("#navigator li a").click((evt) => {
        // evt.preventDefault();
        const urlParts = evt.target.href.split("#");
        if (urlParts.length === 2) {
            $("html,body").animate({scrollTop: $("#" + urlParts[1]).offset().top}, 400, function() {
                // When the animation finishes the active element is updated
                $("#navigator li.active").removeClass("active");
                $(evt.target).parents("li").addClass("active");
            });
        }
    });

    // The current active element is detected from the page URL
    const urlParts = document.location.href.split("#");
    if (urlParts.length === 2) {
        $("#navigator li.active").removeClass("active");
        $(`a[href=\\#${urlParts[1]}]`).parents("li").addClass("active");
    }
}


$(() => {
    handleCodeSystem();
    handleValueSet();
    handleConcept();
    handleECLFilter();
    handleNavigation();
});
