var handleSelect2 = function() {
    $(".multiple-select2").select2({ placeholder: "Select new" });
};

var handleFormWysihtml5 = function () {
	"use strict";
	$('#wysihtml5').wysihtml5();
};


var FormEventCreateNew = function () {
	"use strict";
    return {
        //main function
        init: function () {
			handleSelect2();			
			handleFormWysihtml5();
        }
    };
}();