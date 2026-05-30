frappe.ui.form.on('Task', {
    refresh: function (frm) {

        calculate_task_bom_total(frm);
    },
    // custom_no1: function (frm) {
    //     calculate_total_qty(frm);
    // },

    // custom_no2: function (frm) {
    //     calculate_total_qty(frm);
    // },

    // custom_length: function (frm) {
    //     calculate_total_qty(frm);
    // },

    // custom_width: function (frm) {
    //     calculate_total_qty(frm);
    // },

    // custom_height: function (frm) {
    //     calculate_total_qty(frm);
    // }

});

frappe.ui.form.on('Task BOQ Details', {

    qty: function (frm, cdt, cdn) {
        calculate_row_amount(frm, cdt, cdn);
    },

    rate: function (frm, cdt, cdn) {
        calculate_row_amount(frm, cdt, cdn);
    }

});


function calculate_row_amount(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    row.total_amount = (flt(row.qty) || 0) * (flt(row.rate) || 0);

    frm.refresh_field('custom_bom_details');

    calculate_task_bom_total(frm);
}

// function calculate_total_qty(frm) {
//     let total_qty = (
//         flt(frm.doc.custom_no1) *
//         flt(frm.doc.custom_no2) *
//         flt(frm.doc.custom_length) *
//         flt(frm.doc.custom_width) *
//         flt(frm.doc.custom_height)
//     );
//     frm.set_value("custom_total_quantity", total_qty);
// }


