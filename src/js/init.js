/*!
 * Script to initialise common components along the views, primarily MaterializeCSS components.
 *
 * Biomedical Research Center - Clinical Research and Informatics Unit
 * University College London Hospital
 * 2020
 */

$(function() {
    // Initialise the vertical navbar
    // M.Sidenav.init($(".sidenav")[0], {});

    // Initialise "select" elements
    $("select").not(".disabled").not(".browser-default").each(function() {
        M.FormSelect.init(this, {});
    });

    // Initialise input elements for date selection
    // $("input[data-form-control=date]").datepicker({
    //     format: "dd/mm/yyyy",
    //     showClearBtn: true,
    //     autoClose: true
    // });

    // Automatically resize textarea inputs
    $("textarea.materialize-textarea").each(function(index, elem) {
        M.textareaAutoResize(elem);
    });

    // Prevent forms from being submitted multiple times
    $("form").submit(function () {
        $(this).submit(function () {
            return false;
        });
        return true;
    });

    // Initialise flash messages
    // $(".c-toast").each(function() {
    //     var elem = $(this);
    //     var config = {
    //         html: elem.html()
    //     };
    //     if (elem.hasClass("error")) {
    //         config["displayLength"] = 6000000000000;
    //     }
    //     var toast = M.toast(config);
    //     $(toast.el).find(".toast-action").click(function() {
    //         toast.dismiss();
    //     });
    // });

    // Clean toast elements
    // $(".c-toasts").remove();

    // Initialise dropdown buttons
    $(".dropdown-trigger").dropdown();

    // Handle the tab indicator moving between multiple rows of tabs
    // function updateTabIndicatorTop(tab) {
    //     if (!tab.length) return;
    //     var indicator = tab.siblings(".indicator");
    //     indicator.offset({top: tab.offset().top + tab.outerHeight() - indicator.outerHeight()});
    // }
    // $(".tab").click(function(evt) {
    //     updateTabIndicatorTop($(evt.target).parent(".tab"));
    // });
    // $(window).resize(function() {
    //     updateTabIndicatorTop($(".tabs .tab > a.active").parent(".tab"));
    // });
    // updateTabIndicatorTop($(".tabs .tab > a.active").parent(".tab"));
});
