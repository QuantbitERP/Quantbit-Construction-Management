// Copyright (c) 2026, QTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Statutory Approval Register", {

    refresh (frm){
        frm.set_query("drawing" , function(){
            return {
                filters : {
                    current_rev : "Main"
                }
            }
        })
    },


    drawing: function(frm) {

        frm.clear_table("revisions");
        frm.refresh_field("revisions");

        if (!frm.doc.drawing) {
            return;
        }

        frappe.db.get_doc(
            "Drawing Register",
            frm.doc.drawing
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

    after_save: function(frm) {
        if (!frm.doc.drawing){
            return;
        }
        
        frappe.db.set_value(
            "Drawing Register",
            frm.doc.drawing,
            "is_statutory",
            1
        );

    }

});


