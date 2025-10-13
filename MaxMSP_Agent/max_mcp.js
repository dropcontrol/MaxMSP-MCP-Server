
autowatch = 1; // 1
inlets = 1; // Receive network messages here
outlets = 3; // For status, responses, etc.

var p = this.patcher
var obj_count = 0;
var boxes = [];
var lines = [];

function safe_parse_json(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        outlet(0, "error", "Invalid JSON: " + e.message);
        return null;
    }
}

function split_long_string(inString, maxLength) {
    // var longString = inString.replace(/\s+/g, "");
    var result = [];
    for (var i = 0; i < inString.length; i += maxLength) {
        result.push(inString.substring(i, i + maxLength));
    }
    return result;
}

// Called when a message arrives at inlet 0 (from [udpreceive] or similar)
function anything() {
    var msg = arrayfromargs(messagename, arguments).join(" ");
    var data = safe_parse_json(msg);
    if (!data) return;

    // If patch_id is present, forward to mcp-router.js via outlet 0
    if (data.patch_id) {
        post("max_mcp: Forwarding to router, patch_id=" + data.patch_id + "\n");
        // Use outlet if directly connected, or use messnamed for cross-patch communication
        outlet(0, msg);
        // Also send via messnamed in case router is in a different patch
        messnamed("mcp_router_inlet", msg);
        return;
    }

    // Otherwise, handle locally (for backward compatibility with single-patch mode)
    switch (data.action) {
        case "fetch_test":
            if (data.request_id) {
                get_objects_in_patch(data.request_id);
            } else {
                outlet(0, "error", "Missing request_id for fetch_test");
            }
            break;
        case "get_objects_in_patch":
            if (data.request_id) {
                get_objects_in_patch(data.request_id);
            } else {
                outlet(0, "error", "Missing request_id for get_objects_in_patch");
            }
            break;
        case "get_objects_in_selected":
            if (data.request_id) {
                get_objects_in_selected(data.request_id);
            } else {
                outlet(0, "error", "Missing request_id for get_objects_in_selected");
            }
            break;
        case "get_object_attributes":
            if (data.request_id && data.varname) {
                get_object_attributes(data.request_id, data.varname);
            } else {
                outlet(0, "error", "Missing request_id or varname for get_object_attributes");
            }
            break;
        case "get_avoid_rect_position":
            if (data.request_id) {
                get_avoid_rect_position(data.request_id);
            }
            break;
        case "add_object":
            if (data.obj_type && data.position && data.varname) {
                add_object(data.position[0], data.position[1], data.obj_type, data.args, data.varname);
            } else {
                outlet(0, "error", "Missing obj_type or position or varname for add_object");
            }
            break;
        case "remove_object":
            if (data.varname) {
                remove_object(data.varname);
            } else {
                outlet(0, "error", "Missing varname for remove_object");
            }
            break;
        case "connect_objects":
            if (data.src_varname && data.dst_varname) {
                connect_objects(data.src_varname, data.outlet_idx || 0, data.dst_varname, data.inlet_idx || 0);
            } else {
                outlet(0, "error", "Missing src_varname or dst_varname for connect_objects");
            }
            break;
        case "disconnect_objects":
            if (data.src_varname && data.dst_varname) {
                disconnect_objects(data.src_varname, data.outlet_idx || 0, data.dst_varname, data.inlet_idx || 0);
            } else {
                outlet(0, "error", "Missing src_varname or dst_varname for disconnect_objects");
            }
            break;
        case "set_object_attribute":
            if (data.varname && data.attr_name && data.attr_value) {
                set_object_attribute(data.varname, data.attr_name, data.attr_value);
            } else {
                outlet(0, "error", "Missing varname or attr_name for attr_value");
            }
            break;
        case "set_message_text":
            if (data.varname && data.new_text) {
                set_message_text(data.varname, data.new_text);
            }
            break;
        case "send_message_to_object":
            if (data.varname && data.message) {
                send_message_to_object(data.varname, data.message);
            }
            break;
        case "send_bang_to_object":
            if (data.varname) {
                send_bang_to_object(data.varname);
            }
            break;
        case "set_number":
            if (data.varname && data.num) {
                set_number(data.varname, data.num);
            }
            break;
        default:
            outlet(0, "error", "Unknown action: " + data.action);
    }
}

// function fetch_test(request_id) {
// 	var str = get_patcher_objects(request_id)
// 	//outlet(1, request_id)
// }

function add_object(x, y, type, args, var_name) {
    var new_obj = p.newdefault(x, y, type, args);
    new_obj.varname = var_name;
    if (type == "message" || type == "comment" || type == "flonum") {
        new_obj.message("set", args);
    }
}

function remove_object(var_name) {
	var obj = p.getnamed(var_name);
    if (obj) {
	    p.remove(obj);
    }
}

function connect_objects(src_varname, outlet_idx, dst_varname, inlet_idx) {
    var src = p.getnamed(src_varname);
    var dst = p.getnamed(dst_varname);
    p.connect(src, outlet_idx, dst, inlet_idx);
}

function disconnect_objects(src_varname, outlet_idx, dst_varname, inlet_idx) {
	var src = p.getnamed(src_varname);
    var dst = p.getnamed(dst_varname);
	p.disconnect(src, outlet_idx, dst, inlet_idx);
}

function set_object_attribute(varname, attr_name, attr_value) {
    var obj = p.getnamed(varname);
    if (obj) {
        if (obj.maxclass == "message" || obj.maxclass == "comment") {
            if (attr_name == "text") {
                obj.message("set", attr_value);
            }
        }
        // Check if the attribute exists before setting it
        var attrnames = obj.getattrnames();
        if (attrnames.indexOf(attr_name) == -1) {
            post("Attribute not found: " + attr_name);
            return;
        }
        // Set the attribute
        obj.setattr(attr_name, attr_value);
    } else {
        post("Object not found: " + varname);
    }
}

function set_message_text(varname, new_text) {
    var obj = p.getnamed(varname);
    if (obj) {
        if (obj.maxclass == "message") {
            obj.message("set", new_text);
        } else {
            post("Object is not a message box: " + varname);
        }
    } else {
        post("Object not found: " + varname);
    }
}

function send_message_to_object(varname, message) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message(message);
    } else {
        post("Object not found: " + varname);
    }
}

function send_bang_to_object(varname) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message("bang");
    } else {
        post("Object not found: " + varname);
    }
}

function set_text_in_comment(varname, text) {
    var obj = p.getnamed(varname);
    if (obj) {
        if (obj.maxclass == "comment") {
            obj.message("set", text);
        } else {
            post("Object is not a comment box: " + varname);
        }
    } else {
        post("Object not found: " + varname);
    }
}

function set_number(varname, num) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message("set", num);
    } else {
        post("Object not found: " + varname);
    }
}

// ========================================
// fetch request:

function get_objects_in_patch(request_id) {
    
	var p = this.patcher
    obj_count = 0;
    boxes = [];
    lines = [];

    p.applydeep(collect_objects);
    var patcher_dict = {};
    patcher_dict["boxes"] = boxes;
    patcher_dict["lines"] = lines;

    // use these if no v8:
    // var results = {"request_id": request_id, "results": patcher_dict}
    // outlet(1, "response", split_long_string(JSON.stringify(results, null, 2), 2000));

    // use this if has v8:
    outlet(2, "add_boxtext", request_id, JSON.stringify(patcher_dict, null, 0));
}

function get_objects_in_selected(request_id) {
    
	var p = this.patcher
    obj_count = 0;
    boxes = [];
    lines = [];

    p.applydeepif(collect_objects, function (obj) {
        return obj.selected;
    });
    var patcher_dict = {};
    patcher_dict["boxes"] = boxes;
    patcher_dict["lines"] = lines;

    // use these if no v8:
    // var results = {"request_id": request_id, "results": patcher_dict}
    // outlet(1, "response", split_long_string(JSON.stringify(results, null, 2), 2000));

    // use this if has v8:
    outlet(2, "add_boxtext", request_id, JSON.stringify(patcher_dict, null, 0));
}

function collect_objects(obj) {
    //var keys = Object.keys(obj.varname);
    //post(typeof obj.varname + "\n");
    if (obj.varname.substring(0, 8) == "maxmcpid"){
        return;
    }
    if (!obj.varname){
        obj.varname = "obj-" + obj_count;
    }
    obj_count+=1;

    var outputs = obj.patchcords.outputs;
    if (outputs.length){
        for (var i = 0; i < outputs.length; i++) {
            lines.push({patchline: {
                source: [obj.varname, outputs[i].srcoutlet],
                destination: [outputs[i].dstobject.varname, outputs[i].dstinlet]
            }})
        }
    }
    var attrnames = obj.getattrnames();
    var attr = {};
    if (attrnames.length){
        for (var i = 0; i < attrnames.length; i++) {
            var name = attrnames[i];
            var value = obj.getattr(name);
            attr[name] = value;
        }
    }
    boxes.push({box:{
        maxclass: obj.maxclass,
        varname: obj.varname,
        patching_rect: obj.rect,
        // numinlets: obj.patchcords.inputs.length,
        // numoutputs: obj.patchcords.outputs.length,
        // attributes: attr,
    }})
}

function get_object_attributes(request_id, var_name) {
    
	var p = this.patcher
    var obj = p.getnamed(var_name);
    if (!obj) {
        post("Object not found: " + var_name);
	    return;
    }
    var attrnames = obj.getattrnames();
    var attributes = {};
    if (attrnames.length){
        for (var i = 0; i < attrnames.length; i++) {
            var name = attrnames[i];
            var value = obj.getattr(name);
            attributes[name] = value;
        }
    }

    // use these if no v8:
    // var results = {"request_id": request_id, "results": patcher_dict}
    // outlet(1, "response", split_long_string(JSON.stringify(results, null, 2), 2000));

    // use this if has v8:
    var results = {"request_id": request_id, "results": attributes}
    outlet(1, "response", split_long_string(JSON.stringify(results, null, 0), 2500));
}

function get_window_rect() {
    var w = this.patcher.wind;
    var title = w.title;
    var size = w.size;
    // outlet(1, "response", split_long_string(JSON.stringify(results, null, 0), 2500));
}

function get_avoid_rect_position(request_id) {
    var p = this.patcher;
    var l, t, r, b;
    p.applyif(
        function (obj) {
            if (obj.rect[0] < l || l == undefined) {
                l = obj.rect[0];
            }
            if (obj.rect[1] < t || t == undefined) {
                t = obj.rect[1];
            }
            if (obj.rect[2] > r || r == undefined) {
                r = obj.rect[2];
            }
            if (obj.rect[3] > b || b == undefined) {
                b = obj.rect[3];
            }
        }, 
        function (obj) {
            return obj.varname.substring(0, 8) == "maxmcpid"
    });
    var avoid_rect = [l, t, r, b];

    // use this if has v8:
    var results = {"request_id": request_id, "results": avoid_rect}
    outlet(1, "response", JSON.stringify(results, null, 1));
}

// ========================================
// for debugging use only:


function remove_varname() {
    // for debugging
    // remove all objects' varname
    var p = max.frontpatcher;
    p.applydeep(function (obj) {
        obj.varname = "";
    });
}

function assign_mcp_identifier_to_all_objects() {
    // for debugging
    // remove all objects' varname
	var idx = 0
    var p = max.frontpatcher;
    p.applydeep(function (obj) {
        obj.varname = "maxmcpid-"+idx;
		idx += 1
    });
}


function print_varname() {
    // for debugging
    // remove all objects' varname
    var p = max.frontpatcher;
    p.applydeep(function (obj) {
        post(obj.varname)
    });
}

function parsed_patcher() {
	if (max.frontpatcher.filepath == ""){
		post(NOT_SAVED);
		return;
	}
	var lines = new String();
    var patcher_file = new File(max.frontpatcher.filepath);
    //post("max.frontpatcher.filepath: " + patcher_file + "\n");

	while (patcher_file.position != patcher_file.eof){
		lines += patcher_file.readline();
	}
	patcher_file.close();

    var parsed_patcher = JSON.parse(lines);
	// post(JSON.stringify(parsed_patcher));
}
