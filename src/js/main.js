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
};

/**
 * Send a query to the API and return a `Promise` that handles the response.
 *
 * @param operation
 * @param params
 * @returns {Promise<unknown>}
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
 * @returns {Promise|Promise<unknown>}
 */
function queryFHIRResource(operation, params) {
     return query(operation, params).then((response) => {
         return response.entry || [];
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
                resolve(uniqueResults);
            }
            else {
                const lastQuery = queries.pop();
                lastQuery.then((results) => {
                    results.forEach((item) => {
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
 */
function subscribe(field, callback) {
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

    field.on("change keypress", (evt) => {
        if (evt.type === "keypress" && evt.keyCode !== 13) { return; }
        if (evt.target.value.trim().length < 2) { return; }
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
 * Generic function to handle results of a search when the linked field value changes.
 *
 * @param searchToken
 * @param field
 * @param resultsContainer
 * @param loadingIcon
 * @param apiQueryBuilder
 * @param resultItemBuilder
 * @param onSelectItem
 */
function handleSearchField(searchToken, field, resultsContainer, loadingIcon,
                           apiQueryBuilder,
                           resultItemBuilder, onSelectItem) {
    const searchValue = field.val();
    const targetError = $("#error-container");

    loadingIcon.addClass("rotation");
    loadingIcon.removeClass("paused");

    apiQueryBuilder(searchValue).then(
        (results) => {
            if (context.latestSearchToken !== searchToken) { return; }

            console.debug(results);
            targetError.hide(200);
            if (results.length > 0) {
                resultsContainer.html("");
                results.forEach((item) => {
                    const itemDOM = resultItemBuilder(item);
                    itemDOM.data(item);
                    resultsContainer.append(itemDOM);
                });
                resultsContainer.find(".clickable").click((evt) => onSelectItem($(evt.currentTarget).data()));
                resultsContainer.show(0);
            }
            else {
                resultsContainer.hide(0);
            }
            loadingIcon.addClass("paused");
        },
        (error) => {
            loadingIcon.addClass("paused");
            console.error(error);
            try {
                const jsonError = JSON.parse(error.message);
                console.debug(jsonError);
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
        return handleSearchField(
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
        return handleSearchField(
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
    subscribe($("#concepts-search"), (searchToken, field) => {
        return handleSearchField(
            searchToken,
            field,
            $("#concepts-results"),
            $("#concepts-loading"),
            (value) => {
                return query("ValueSet/$expand",{
                    // "url": context.valueSet.resource.url,
                    "url": $("#value-sets-search").val(),
                    "filter": value,
                    "offset": 0,
                    "count": 100,
                    "activeOnly": true
                }).then((response) => {
                    console.log(response);
                    return response.expansion.contains || [];
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
        );
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
            if (filter.code) {
                shortECL.push(`${filter.op} ${filter.code}|${filter.label}|`);
                longECL.push(`${filter.opLong} ${filter.code}|${filter.label}|`);
            }
        });
        console.debug(shortECL);
        console.debug(longECL);

        // Display long ECL
        setVal(eclSearchField, shortECL.join(", "));
        eclSearchField.change();
    };

    const addFilterFields = (scroll, operator, code, label) => {
        const lastWrapper = $(".ecl-filter-wrapper:last-child");
        const button = lastWrapper.find(".ecl-filter-add");
        const newWrapper = $("<div class=ecl-filter-wrapper></div>")
            .hide()
            .append($("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-operator").clone()))
            .append($("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-code").clone()))
            .append($("<div class=input-field></div>").html(lastWrapper.find(".ecl-filter-label").clone()))
            .append($("<div class=input-field></div>").html(button.clone()));
        button.replaceWith($("<div></div>").css("width", 42));
        newWrapper.find("input, select").on("change keypress", updateSearchString);
        newWrapper.find(".ecl-filter-add").click(() => { addFilterFields(true); });

        // Provide initial values if given
        const select = newWrapper.find(".ecl-filter-operator");
        if (operator) {
            select.val(select.find(`option[data-long-value=${operator}]`)[0].value);
        }
        newWrapper.find(".ecl-filter-code").val(code || "");
        newWrapper.find(".ecl-filter-label").val(label || "");

        newWrapper.insertAfter(lastWrapper);
        $("select").not(".disabled").not(".browser-default").each(function() {
            M.FormSelect.init(this, {});
        });
        newWrapper.show(200);

        // Scroll down
        if (scroll) {
            const scrollPoint = newWrapper.position().top + newWrapper.find(".input-field:first-child").height();
            $('html,body').animate({scrollTop: scrollPoint}, 1000);
        }
    };

    eclFields.on("change keypress", updateSearchString);
    eclAddBtn.click(() => { addFilterFields(true); });

    subscribe(eclSearchField, (searchToken, field) => {
        return handleSearchField(
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
                    "url": url,
                    "offset": 0,
                    "count": 100,
                    "activeOnly": true
                }).then((response) => {
                    return response.expansion.contains || [];
                });
            },
            (concept) => {
                // Button to display the children of this concept
                const childrenBtn = $("<button>Children</button>")
                    .addClass("btn btn-small white uclh-primary-text")
                    .click(() => {
                        addFilterFields(false, "descendantOf", concept.code, concept.display);
                        updateSearchString();
                    });

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
                            .html($("<span></span>")
                                .attr({"data-badge-caption": concept.system})
                                .addClass("new badge"))
                            .addClass("ecl-concept-system"),
                        $("<div></div>")
                            .html(childrenBtn)
                            .addClass("ecl-concept-btn")
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
        );
    });
}

$(() => {
    handleCodeSystem();
    handleValueSet();
    handleConcept();
    handleECLFilter();
});