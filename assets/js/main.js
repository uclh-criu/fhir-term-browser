/*!
 * Main script file for project-specific elements.
 * Contains the logic to communicate with the Terminology Server.
 *
 * Biomedical Research Center - Clinical Research and Informatics Unit
 * University College London Hospital
 * 2020
 */

 function query(operation, params) {
    let endpoint = "https://ontoserver.dataproducts.nhs.uk/fhir/";
    return new Promise((resolve, reject) => {
        let queryData = {
            url: endpoint + operation,
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

function searchCodeSystems(value) {
    let targetDOM = $("#code-systems");
    let targetError = $("#error-container");

    let loadingIcon = $("#code-systems-loading");
    loadingIcon.addClass("rotation");
    loadingIcon.removeClass("paused");

/*
 * TODO: The server does not accept , in search parameters
 */

    query("CodeSystem", {
        "description:contains": value,
        _elements: "url,description,name,title"
    }).then(
        result => {
            console.log(result);
            targetError.hide(200);
            let resultsDOM = $("<div></div>");
            if (result.entry) {
                result.entry.forEach(element => {
                    let res = element.resource;
                    resultsDOM.append(
                        $("<div></div>")
                            .addClass("collection-item")
                            .css({overflow: "auto"})
                            .append(
                                $("<div></div>").html(res.title || res.name),
                                $("<div></div>")
                                    .css({background: "#EEE"})
                                    .html(res.description),
                                $("<span></span>")
                                    .css({float: "none", margin: 0})
                                    .attr({"data-badge-caption": res.url})
                                    .addClass("new badge")
                            )
                    );
                });
                targetDOM.html(resultsDOM.html());
                targetDOM.show(0);
            }
            else {
                targetDOM.hide(0);
            }
            loadingIcon.addClass("paused");
        },
        error => {
            loadingIcon.addClass("paused");
            console.error(error);
            try {
                let jsonError = JSON.parse(error.message);
                console.log(jsonError);
                targetError.html(JSON.stringify(jsonError, null, 2));
            }
            catch {
                targetError.html(error.message);
            }
            targetError.show(200);
        }
    );
}

$(() => {
    let inputSearch = $("#code-systems-search");
    let updateCodeSystems = () => {
        searchCodeSystems(inputSearch.val());
    }

    // Search while writing in the search input
    // https://stackoverflow.com/a/14042239
    // Chrome Fix (Use keyup over keypress to detect backspace)
    var timeoutReference = null;
    inputSearch.on("keyup keypress paste", function(evt) {
        if (evt.keyCode === 13) { evt.preventDefault(); return; }
        if (evt.type === "keyup" && evt.keyCode !== 8 && evt.keyCode !== 46) { return; }
        if (timeoutReference) { clearTimeout(timeoutReference); }
        timeoutReference = setTimeout(updateCodeSystems, 300);
    });
});