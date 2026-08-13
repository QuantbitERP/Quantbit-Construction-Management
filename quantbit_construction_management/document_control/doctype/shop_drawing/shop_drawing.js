// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Shop Drawing", {

    refresh (frm){
        frm.set_query("related_drawing" , function(){
            return {
                filters : {
                    current_rev : "Main"
                }
            }
        })
    },


    related_drawing: function(frm) {

        frm.clear_table("revisions");
        frm.refresh_field("revisions");

        if (!frm.doc.related_drawing) {
            return;
        }

        frappe.db.get_doc(
            "Drawing Register",
            frm.doc.related_drawing
        ).then(doc => {

            console.log("Drawing Register Data:", doc);
            console.log("Revision History Data:", doc.revisions);

            if (doc.revisions && doc.revisions.length > 0) {

                doc.revisions.forEach(row => {

                    console.log("Copying Revision Row:", row);

                    let child = frm.add_child("revisions");

                    child.revision = row.revision;
                    child.revision_date = row.revision_date;
                    child.purpose = row.purpose;
                    child.description = row.description;
                    child.issued_by = row.issued_by;
                    child.status = row.status;
                    child.transmittal_no = row.transmittal_no;
                    child.file = row.file;

                });

                frm.refresh_field("revisions");
            }

        });

    },

    after_submit: function(frm) {
        if (!frm.doc.related_drawing){
            return;
        }
        
        frappe.db.set_value(
            "Drawing Register",
            frm.doc.related_drawing,
            "is_shop_drawing",
            1
        );

    }

});

