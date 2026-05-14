frappe.ui.form.on("Site Diary", {
refresh(frm) {

    if (!frm.is_new()) return;

    let lat = 16.8524;
    let lon = 74.5815;

    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_current_weather",
        args: {
            lat: lat,
            lon: lon
        },
        callback: function(r) {
            if (r.message) {
                let w = r.message;   
                let hour = new Date().getHours();

                let weather_text = getWeatherText(w.weather_code);

                if (hour < 12) {
                    frm.set_value("weather_am", weather_text);
                    console.log("AM Weather:", weather_text);
                } else {
                    frm.set_value("weather_pm", weather_text);
                    console.log("PM Weather:", weather_text);
                }

                frm.set_value("max_temp", w.max_temp);
                frm.set_value("min_temp", w.min_temp);
                frm.set_value("wind_speed_kmh", w.wind_speed_kmh);
            }
        }
    });
},



setup(frm) {

    frm.set_query("task", "task", function (doc, cdt, cdn) {

        return {
            filters: {
                custom_is_stage: 0,
                is_group: 1,
                project: doc.project
            }
        };

    });

},

after_save(frm) {

	if (!frm.doc.project) return;

	// 🔥 notify project screen
	frappe.publish_realtime("project_progress_refresh", {
		project: frm.doc.project
	});

}


});

frappe.ui.form.on("Task Summary", {

    task(frm) {

        load_dpr_activity_progress(frm);

    },

    task_remove(frm) {

        load_dpr_activity_progress(frm);

    }

});

function load_dpr_activity_progress(frm) {

    if (!frm.doc.task || !frm.doc.task.length) {
        frm.set_value("activity_progress", []);
        return;
    }

frappe.call({
    method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.update_daily_activity_progress_table",
    args: {
        doc: frm.doc
    },
    callback(r) {

        if (!r.message) return;

        let new_data = r.message.activity_progress || [];
        let existing = frm.doc.activity_progress || [];

        let updated_rows = [];

        // 🔹 Step 1: Keep only rows whose parent_task still exists
        let valid_parent_tasks = frm.doc.task.map(t => t.task);

        existing.forEach(row => {
            if (valid_parent_tasks.includes(row.parent_task)) {
                updated_rows.push(row);
            }
        });

        // 🔹 Step 2: Add missing new subtasks
        new_data.forEach(new_row => {

            let exists = updated_rows.find(r =>
                r.parent_task === new_row.parent_task &&
                r.task === new_row.task
            );

            if (!exists) {
                updated_rows.push(new_row);
            }

        });

        // 🔹 Step 3: Set merged data
        frm.set_value("activity_progress", updated_rows);

    }
});


}

frappe.ui.form.on("DPR Activity Progress", {

    planned_today(frm, cdt, cdn) {

        validate_progress_limits(frm, cdt, cdn, "planned_today");

    },

    achieved_today(frm, cdt, cdn) {

        update_progress(frm, cdt, cdn);
        validate_progress_limits(frm, cdt, cdn, "achieved_today");

    },

    total_qty(frm, cdt, cdn) {

        update_progress(frm, cdt, cdn);

    }

});

function validate_progress_limits(frm, cdt, cdn, fieldname) {

    let row = locals[cdt][cdn];

    let total_qty = row.total_qty || 0;
    let achieved_today = row.achieved_today || 0;

    let previous_today = row._previous_achieved_today || 0;
    let base_achieved = (row.total_achieved || 0) - previous_today;

    let remaining_qty = total_qty - base_achieved;

    let entered_value = row[fieldname] || 0;

    if (entered_value > remaining_qty) {

        frappe.msgprint({
            title: "Invalid Entry",
            message: `${fieldname.replace("_", " ")} cannot exceed remaining quantity (${remaining_qty})`,
            indicator: "red"
        });

        return;
    }
}

function update_progress(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    let total_qty = row.total_qty || 0;
    let achieved_today = row.achieved_today || 0;
    let previous_today = row._previous_achieved_today || 0;
    let base_achieved = (row.total_achieved || 0) - previous_today;
    let new_total = base_achieved + achieved_today;

    if (new_total > total_qty) {

        frappe.msgprint({
            title: "Invalid Entry",
            message: "Total achieved cannot exceed total quantity",
            indicator: "red"
        });

        row.achieved_today = 0;
        row.total_achieved = base_achieved;
        row._previous_achieved_today = 0;

    } else {
        row.total_achieved = new_total;
        row._previous_achieved_today = achieved_today;
    }

    if (total_qty > 0) {
        row.percent_completed = (row.total_achieved / total_qty) * 100;
    } else {
        row.percent_completed = 0;
    }

    frm.refresh_field("activity_progress");
}
frappe.ui.form.on("Manpower Log", {

    skilled: function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (flt(row.skilled) > 0 && flt(row.unskilled) > 0) {

            frappe.msgprint({
                title: __("Invalid Entry"),
                message: __(
                    "Only Skilled OR Unskilled can be entered in one row"
                ),
                indicator: "red"
            });

            frappe.model.set_value(
                cdt,
                cdn,
                "unskilled",
                0
            );
        }

        calculate_total(frm, cdt, cdn);
    },

    unskilled: function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (flt(row.skilled) > 0 && flt(row.unskilled) > 0) {

            frappe.msgprint({
                title: __("Invalid Entry"),
                message: __(
                    "Only Skilled OR Unskilled can be entered in one row"
                ),
                indicator: "red"
            });

            frappe.model.set_value(
                cdt,
                cdn,
                "skilled",
                0
            );
        }

        calculate_total(frm, cdt, cdn);
    },

    hours_worked: function(frm, cdt, cdn) {

        validate_hours(frm, cdt, cdn);
    },

    overtime_hours: function(frm, cdt, cdn) {

        validate_hours(frm, cdt, cdn);
    },

    daily_wages: function(frm, cdt, cdn) {

        calculate_total_wages(frm, cdt, cdn);
    },

    total: function(frm, cdt, cdn) {

        calculate_total_wages(frm, cdt, cdn);
    }

});
frappe.ui.form.on("Site Equipment Log", {

    rate: function(frm, cdt, cdn) {
        calculate_equipment_total(frm, cdt, cdn);
    },

    working_hours: function(frm, cdt, cdn) {
        calculate_equipment_total(frm, cdt, cdn);
    },
    quantity: function(frm, cdt, cdn) {
        calculate_equipment_total(frm, cdt, cdn);
    },

});

function calculate_equipment_total(frm, cdt, cdn) {

    let row = locals[cdt][cdn];
    
    let quantity =row.quantity;

    let rate = flt(row.rate || 0);

    let working_hours = flt(row.working_hours || 0);

    let total_amount = quantity* rate * working_hours;

    frappe.model.set_value(
        cdt,
        cdn,
        "total_amount",
        total_amount
    );

}

function calculate_total(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    let total =
        (row.skilled || 0) +
        (row.unskilled || 0)

    frappe.model.set_value(cdt, cdn, "total", total);

    update_parent_total(frm);


    }

function calculate_total_wages(frm, cdt, cdn) {

	let row = locals[cdt][cdn];

	let skilled = flt(row.skilled || 0);

	let unskilled = flt(row.unskilled || 0);


	let daily_wages = flt(row.daily_wages || 0);

	let total_workers = skilled + unskilled;

	let total_wage = total_workers * daily_wages;

	frappe.model.set_value(cdt, cdn, "total_wage", total_wage);
}

function validate_hours(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    let total_hours =
        (row.hours_worked || 0) +
        (row.overtime_hours || 0);

    if (total_hours > 16) {

        frappe.msgprint(
            "Working Hours + Overtime Hours must be between 0 and 16"
        );

        frappe.model.set_value(cdt, cdn, "hours_worked", 8);
        frappe.model.set_value(cdt, cdn, "overtime_hours", 0);
    }


    }

function getWeatherText(code) {
    const map = {
    0: "Clear sky ☀️",

        1: "Mainly clear 🌤️",
        2: "Partly cloudy ⛅",
        3: "Overcast ☁️",

        45: "Fog 🌫️",
        48: "Freezing fog ❄️🌫️",

        51: "Light drizzle 🌦️",
        53: "Moderate drizzle 🌦️",
        55: "Dense drizzle 🌧️",

        61: "Slight rain 🌧️",
        63: "Moderate rain 🌧️",
        65: "Heavy rain 🌧️",

        71: "Slight snow ❄️",
        73: "Moderate snow ❄️",
        75: "Heavy snow ❄️",

        80: "Rain showers 🌦️",
        81: "Moderate rain showers 🌧️",
        82: "Violent rain showers ⛈️",

        85: "Snow showers 🌨️",
        86: "Heavy snow showers 🌨️",

        95: "Thunderstorm ⛈️",
        96: "Thunderstorm with hail ⛈️🧊",
        99: "Severe thunderstorm ⛈️"
    };

return map[code] || "Unknown weather";


}

frappe.ui.form.on("Task Summary", {
task: function(frm, cdt, cdn) {

    let row = locals[cdt][cdn];

    if (!row.task) return;

    frappe.call({
        method: "quantbit_construction_management.site_diary.doctype.site_diary.site_diary.get_task_bom_details",
        args: {
            task: row.task
        },
        callback: function(r) {

            if (!r.message) return;
            console.log(r.message)
            // MATERIALS
            r.message.materials.forEach(d => {

                let row = frm.add_child("material_deliveries");
                row.item = d.item;
                row.item_type = d.item_type;
                row.unit = d.uom;
            });

            // MANPOWER
            // r.message.manpower.forEach(d => {

            //     let row = frm.add_child("manpower_log");
            //     row.parent_task = d.parent_task;
            //     row.task = d.task;
            //     row.task_subject = d.task_subject;
            //     row.tradecategory = d.item;
            //     row.item_type = d.item_type;
            //     MANPOWER
// MANPOWER
            r.message.manpower.forEach(d => {
                let child = frm.add_child("manpower_log");

                frappe.model.set_value(child.doctype, child.name, "parent_task", d.parent_task);
                frappe.model.set_value(child.doctype, child.name, "task", d.task);
                frappe.model.set_value(child.doctype, child.name, "task_subject", d.task_subject);
                frappe.model.set_value(child.doctype, child.name, "item_type", d.item_type);

                // Set tradecategory first, then fetch daily_wages manually
                frappe.model.set_value(child.doctype, child.name, "tradecategory", d.item).then(() => {
                    if (d.item) {
                        frappe.db.get_value("Item", d.item, "custom_daily_wages").then(r => {
                            if (r.message && r.message.custom_daily_wages) {
                                frappe.model.set_value(
                                    child.doctype,
                                    child.name,
                                    "daily_wages",
                                    r.message.custom_daily_wages
                                );
                                frm.refresh_field("manpower_log");
                            }
                        });
                    }
                });
            });


            // EQUIPMENT
            r.message.equipment.forEach(d => {

                let row = frm.add_child("equipment_log");
                row.parent_task = d.parent_task;
                row.task = d.task;
                row.task_subject = d.task_subject;
                row.item = d.item;
                row.equipment_name= d.item;
                row.item_type = d.item_type;
            });

            frm.refresh_field("material_deliveries");
            frm.refresh_field("manpower_log");
            frm.refresh_field("equipment_log");
        }
    });
}


});