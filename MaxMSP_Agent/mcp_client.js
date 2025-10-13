// mcp_client.js
// MaxMCP Client - Connects to MaxMCP router via messnamed and operates on this.patcher
// Place in each patch as [js mcp_client.js patch_id] or use abstraction [mcp-client patch_id]

// ========================================
// GLOBAL CONFIGURATION
// ========================================

autowatch = 1;
inlets = 1;  // Need inlet to receive messages from [receive mcp_client_<patch_id>]
outlets = 1;  // Outlet for sending responses

// ========================================
// CONSTANTS
// ========================================

var MCP_PREFIX = "mcp-client";
var MAXMCPID_PREFIX = "maxmcpid";
var RECEIVER_X = 10;
var RECEIVER_Y = 10;
var SENDER_X = 10;
var SENDER_Y = 50;

// ========================================
// STATE VARIABLES
// ========================================

var my_patch_id = "";
var p = this.patcher;
var obj_count = 0;
var boxes = [];
var lines = [];

// ========================================
// UTILITY FUNCTIONS
// ========================================

function safe_parse_json(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        post("mcp-client: Invalid JSON: " + e.message + "\n");
        return null;
    }
}

function should_exclude_object(varname) {
    return varname.substring(0, 8) === MAXMCPID_PREFIX ||
           varname.substring(0, 10) === MCP_PREFIX;
}

function log_info(message) {
    post("mcp-client[" + my_patch_id + "]: " + message + "\n");
}

function log_error(message) {
    post("mcp-client[" + my_patch_id + "]: ERROR - " + message + "\n");
}

// ========================================
// INITIALIZATION
// ========================================

// Set patch_id from jsarguments and auto-register
function loadbang() {
    if (jsarguments.length > 1) {
        initialize_patch_id();
        setup_receiver();
        setup_sender();
        register_with_router();
    } else {
        post("mcp-client ERROR: No patch_id provided! Usage: [js mcp_client.js your_patch_id]\n");
    }
}

function initialize_patch_id() {
    // Get the first argument and remove any "#1", "#2" etc from abstraction expansion
    my_patch_id = String(jsarguments[1]).replace(/#\d+$/, "");
    post("mcp-client initialized with patch_id: " + my_patch_id + "\n");

    // Set varname for this js object if not already set
    if (!this.box.varname) {
        this.box.varname = "mcp_js_" + my_patch_id;
    }
}

function setup_receiver() {
    // Create [receive mcp_client_<patch_id>] dynamically
    var receiver_name = "mcp_client_" + my_patch_id;
    var receive_obj = p.newdefault(RECEIVER_X, RECEIVER_Y, "receive", receiver_name);
    receive_obj.varname = "mcp_receiver_" + my_patch_id;

    // Connect the receiver to this js object
    var this_js = p.getnamed(this.box.varname);
    if (this_js) {
        p.connect(receive_obj, 0, this_js, 0);
        log_info("Created and connected receiver");
    } else {
        log_error("Could not find this js object");
    }
}

function setup_sender() {
    // Create [send mcp_router_events] and connect outlet to it
    var send_obj = p.newdefault(SENDER_X, SENDER_Y, "send", "mcp_router_events");
    send_obj.varname = "mcp_sender_" + my_patch_id;

    var this_js = p.getnamed(this.box.varname);
    if (this_js) {
        p.connect(this_js, 0, send_obj, 0);
        log_info("Created and connected sender to mcp_router_events");
    }
}

function register_with_router() {
    messnamed("mcp_register", my_patch_id);
    log_info("Registration request sent");
}

// ========================================
// MESSAGE ROUTING
// ========================================

// Handle incoming messages from router via messnamed
function msg_from_router() {
    anything();
}

// Main message handler - receives messages from node.script
function anything() {
    // mcp-router sends: messnamed("mcp_client_test1", msg_type, json_str)
    // messagename = msg_type (e.g., "request" or "command")
    // arguments[0] = json_str
    var json_str = arguments[0];
    var data = safe_parse_json(json_str);
    if (!data) return;

    // Only process messages for this patch
    if (data.patch_id !== my_patch_id) {
        return;
    }

    log_info("Processing: " + data.action);
    route_action(data);
}

function route_action(data) {
    switch (data.action) {
        // Query actions
        case "get_objects_in_patch":
            if (data.request_id) {
                get_objects_in_patch(data.request_id);
            }
            break;
        case "get_objects_in_selected":
            if (data.request_id) {
                get_objects_in_selected(data.request_id);
            }
            break;
        case "get_object_attributes":
            if (data.request_id && data.varname) {
                get_object_attributes(data.request_id, data.varname);
            }
            break;
        case "get_avoid_rect_position":
            if (data.request_id) {
                get_avoid_rect_position(data.request_id);
            }
            break;

        // Manipulation actions
        case "add_object":
            if (data.obj_type && data.position && data.varname) {
                add_object(data.position[0], data.position[1], data.obj_type, data.args, data.varname);
                send_success_response(data.request_id, { varname: data.varname });
            }
            break;
        case "remove_object":
            if (data.varname) {
                remove_object(data.varname);
                send_success_response(data.request_id);
            }
            break;
        case "connect_objects":
            if (data.src_varname && data.dst_varname) {
                connect_objects(data.src_varname, data.outlet_idx || 0, data.dst_varname, data.inlet_idx || 0);
                send_success_response(data.request_id);
            }
            break;
        case "disconnect_objects":
            if (data.src_varname && data.dst_varname) {
                disconnect_objects(data.src_varname, data.outlet_idx || 0, data.dst_varname, data.inlet_idx || 0);
                send_success_response(data.request_id);
            }
            break;
        case "set_object_attribute":
            if (data.varname && data.attr_name && data.attr_value) {
                set_object_attribute(data.varname, data.attr_name, data.attr_value);
                send_success_response(data.request_id);
            }
            break;
        case "set_message_text":
            if (data.varname && data.new_text) {
                set_message_text(data.varname, data.new_text);
                send_success_response(data.request_id);
            }
            break;
        case "send_message_to_object":
            if (data.varname && data.message) {
                send_message_to_object(data.varname, data.message);
                send_success_response(data.request_id);
            }
            break;
        case "send_bang_to_object":
            if (data.varname) {
                send_bang_to_object(data.varname);
                send_success_response(data.request_id);
            }
            break;
        case "set_number":
            if (data.varname && data.num !== undefined) {
                set_number(data.varname, data.num);
                send_success_response(data.request_id);
            }
            break;

        default:
            log_info("Unknown action: " + data.action);
    }
}

// ========================================
// RESPONSE HANDLING
// ========================================

function send_response(request_id, result) {
    var response = {
        "request_id": request_id,
        "patch_id": my_patch_id,
        "results": result
    };
    var json_str = JSON.stringify(response);
    log_info("Sending response via outlet, length=" + json_str.length);
    outlet(0, "response", json_str);
}

function send_success_response(request_id, additional_data) {
    var result = { "status": "success" };
    if (additional_data) {
        for (var key in additional_data) {
            result[key] = additional_data[key];
        }
    }
    send_response(request_id, result);
}

// ========================================
// PATCHER MANIPULATION FUNCTIONS
// ========================================

function add_object(x, y, type, args, var_name) {
    var new_obj = p.newdefault(x, y, type, args);
    new_obj.varname = var_name;
    if (type === "message" || type === "comment" || type === "flonum") {
        new_obj.message("set", args);
    }
    log_info("Added " + type + " as " + var_name);
}

function remove_object(var_name) {
    var obj = p.getnamed(var_name);
    if (obj) {
        p.remove(obj);
        log_info("Removed " + var_name);
    }
}

function connect_objects(src_varname, outlet_idx, dst_varname, inlet_idx) {
    var src = p.getnamed(src_varname);
    var dst = p.getnamed(dst_varname);
    if (src && dst) {
        p.connect(src, outlet_idx, dst, inlet_idx);
        log_info("Connected " + src_varname + " -> " + dst_varname);
    }
}

function disconnect_objects(src_varname, outlet_idx, dst_varname, inlet_idx) {
    var src = p.getnamed(src_varname);
    var dst = p.getnamed(dst_varname);
    if (src && dst) {
        p.disconnect(src, outlet_idx, dst, inlet_idx);
        log_info("Disconnected " + src_varname + " -X- " + dst_varname);
    }
}

function set_object_attribute(varname, attr_name, attr_value) {
    var obj = p.getnamed(varname);
    if (!obj) return;

    // Special handling for message and comment objects
    if ((obj.maxclass === "message" || obj.maxclass === "comment") && attr_name === "text") {
        obj.message("set", attr_value);
        log_info("Set text for " + varname);
        return;
    }

    // Check if attribute exists
    var attrnames = obj.getattrnames();
    if (attrnames.indexOf(attr_name) === -1) {
        log_info("Attribute not found: " + attr_name);
        return;
    }

    obj.setattr(attr_name, attr_value);
    log_info("Set attr " + attr_name);
}

function set_message_text(varname, new_text) {
    var obj = p.getnamed(varname);
    if (obj && obj.maxclass === "message") {
        obj.message("set", new_text);
        log_info("Set message text " + varname);
    }
}

function send_message_to_object(varname, message) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message(message);
        log_info("Sent message to " + varname);
    }
}

function send_bang_to_object(varname) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message("bang");
        log_info("Sent bang to " + varname);
    }
}

function set_number(varname, num) {
    var obj = p.getnamed(varname);
    if (obj) {
        obj.message("set", num);
        log_info("Set number " + varname + " = " + num);
    }
}

// ========================================
// QUERY FUNCTIONS
// ========================================

function get_objects_in_patch(request_id) {
    reset_collection_state();
    p.applydeep(collect_objects);
    var patcher_dict = create_patcher_dict();
    send_response(request_id, patcher_dict);
    log_info("Fetched " + boxes.length + " objects");
}

function get_objects_in_selected(request_id) {
    reset_collection_state();
    p.applydeepif(collect_objects, is_object_selected);
    var patcher_dict = create_patcher_dict();
    send_response(request_id, patcher_dict);
    log_info("Fetched " + boxes.length + " selected objects");
}

function is_object_selected(obj) {
    return obj.selected;
}

function reset_collection_state() {
    obj_count = 0;
    boxes = [];
    lines = [];
}

function create_patcher_dict() {
    return {
        "boxes": boxes,
        "lines": lines
    };
}

function collect_objects(obj) {
    if (should_exclude_object(obj.varname)) {
        return;
    }

    // Auto-generate varname if not set
    if (!obj.varname) {
        obj.varname = "obj-" + obj_count;
    }
    obj_count += 1;

    // Collect patch cords
    collect_patch_cords(obj);

    // Add box information
    boxes.push({
        box: {
            maxclass: obj.maxclass,
            varname: obj.varname,
            patching_rect: obj.rect,
        }
    });
}

function collect_patch_cords(obj) {
    var outputs = obj.patchcords.outputs;
    if (outputs.length) {
        for (var i = 0; i < outputs.length; i++) {
            lines.push({
                patchline: {
                    source: [obj.varname, outputs[i].srcoutlet],
                    destination: [outputs[i].dstobject.varname, outputs[i].dstinlet]
                }
            });
        }
    }
}

function get_object_attributes(request_id, var_name) {
    var obj = p.getnamed(var_name);
    if (!obj) {
        send_response(request_id, { "error": "Object not found: " + var_name });
        return;
    }

    var attrnames = obj.getattrnames();
    var attributes = {};
    if (attrnames.length) {
        for (var i = 0; i < attrnames.length; i++) {
            var name = attrnames[i];
            var value = obj.getattr(name);
            attributes[name] = value;
        }
    }

    send_response(request_id, attributes);
    log_info("Fetched attributes for " + var_name);
}

function get_avoid_rect_position(request_id) {
    var bounds = calculate_object_bounds();
    var avoid_rect = [bounds.left, bounds.top, bounds.right, bounds.bottom];
    send_response(request_id, avoid_rect);
    log_info("Calculated avoid rect");
}

function calculate_object_bounds() {
    var bounds = { left: undefined, top: undefined, right: undefined, bottom: undefined };

    p.applyif(
        function (obj) {
            if (obj.rect[0] < bounds.left || bounds.left === undefined) {
                bounds.left = obj.rect[0];
            }
            if (obj.rect[1] < bounds.top || bounds.top === undefined) {
                bounds.top = obj.rect[1];
            }
            if (obj.rect[2] > bounds.right || bounds.right === undefined) {
                bounds.right = obj.rect[2];
            }
            if (obj.rect[3] > bounds.bottom || bounds.bottom === undefined) {
                bounds.bottom = obj.rect[3];
            }
        },
        function (obj) {
            return !should_exclude_object(obj.varname);
        }
    );

    return bounds;
}
