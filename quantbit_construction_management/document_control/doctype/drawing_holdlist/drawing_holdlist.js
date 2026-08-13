// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Drawing Holdlist", {

    refresh (frm){
        frm.set_query("drawing" , function(){
            return {
                filters : {
                    current_rev : "Main"
                }
            }
        })
    },

    after_submit: function(frm) {
        if (!frm.doc.drawing){
            return;
        }
        
        frappe.db.set_value(
            "Drawing Register",
            frm.doc.drawing,
            "holdlist_flag",
            1
        );

    }

});



