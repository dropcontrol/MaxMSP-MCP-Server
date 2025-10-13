// mcp-router.js
// Routes messages between max_mcp_node.js and mcp-client.js instances
// Manages patch registration and message routing based on patch_id

// ========================================
// GLOBAL CONFIGURATION
// ========================================

autowatch = 1;
inlets = 1;  // Receive JSON from max_mcp_node.js
outlets = 1; // For forwarding messages to max_mcp_node.js

// ========================================
// STATE VARIABLES
// ========================================

// Track registered patches: { patch_id: true }
var registered_patches = {};

// ========================================
// CONSTANTS
// ========================================

var MSG_TYPE_COMMAND = "command";
var MSG_TYPE_REQUEST = "request";
var GLOBAL_ACTION_LIST_PATCHES = "list_registered_patches";

// ========================================
// PATCH REGISTRATION MANAGEMENT
// ========================================

// Handle registration from mcp-client.js instances
function mcp_register() {
    var patch_id = arrayfromargs(arguments).join(" ");
    register_patch(patch_id);
}

function mcp_unregister() {
    var patch_id = arrayfromargs(arguments).join(" ");
    unregister_patch(patch_id);
}

function register_patch(patch_id) {
    registered_patches[patch_id] = true;
    log_info("✓ Registered patch_id=" + patch_id);
    notify_node_registration(patch_id);
}

function unregister_patch(patch_id) {
    delete registered_patches[patch_id];
    log_info("Unregistered patch_id=" + patch_id);
    notify_node_unregistration(patch_id);
}

function is_patch_registered(patch_id) {
    return !!registered_patches[patch_id];
}

function get_registered_patch_list() {
    var patch_list = [];
    for (var patch_id in registered_patches) {
        patch_list.push(patch_id);
    }
    return patch_list;
}

// ========================================
// NODE COMMUNICATION
// ========================================

function notify_node_registration(patch_id) {
    outlet(0, "mcp_router_register", patch_id);
}

function notify_node_unregistration(patch_id) {
    outlet(0, "mcp_router_unregister", patch_id);
}

function forward_response_to_node(json_str) {
    outlet(0, "response", json_str);
}

// ========================================
// RESPONSE HANDLING
// ========================================

// Handle responses from mcp-client.js instances
function mcp_reply() {
    log_debug("mcp_reply() ENTERED, arguments.length=" + arguments.length);
    var json_str = arrayfromargs(arguments).join(" ");
    log_debug("mcp_reply called, json_str length=" + json_str.length + ", forwarding via outlet");
    forward_response_to_node(json_str);
    log_debug("mcp_reply outlet sent");
}

// ========================================
// MESSAGE ROUTING
// ========================================

// Receive command/request from max_mcp_node.js via inlet
function anything() {
    var msg = arrayfromargs(messagename, arguments);

    if (msg.length < 1) return;

    var json_str = msg.join(" ");

    // Only process JSON messages
    if (!is_json_message(json_str)) {
        return;
    }

    var data = parse_json_safely(json_str);
    if (!data) return;

    route_message(data, json_str);
}

function is_json_message(str) {
    return str.charAt(0) === '{';
}

function parse_json_safely(json_str) {
    try {
        return JSON.parse(json_str);
    } catch (e) {
        log_error("JSON parse error: " + e);
        return null;
    }
}

function route_message(data, json_str) {
    // Handle global commands (no patch_id required)
    if (is_global_command(data)) {
        handle_global_command(data);
        return;
    }

    // Validate patch_id presence
    if (!data.patch_id) {
        log_warn("No patch_id in message");
        return;
    }

    // Validate patch registration
    if (!is_patch_registered(data.patch_id)) {
        log_warn("Patch not registered: " + data.patch_id);
        return;
    }

    // Route to specific patch
    route_to_patch(data, json_str);
}

function is_global_command(data) {
    return data.action === GLOBAL_ACTION_LIST_PATCHES && data.request_id;
}

function handle_global_command(data) {
    if (data.action === GLOBAL_ACTION_LIST_PATCHES) {
        handle_list_registered_patches(data.request_id);
    }
}

function route_to_patch(data, json_str) {
    var patch_id = data.patch_id;
    var msg_type = determine_message_type(data);

    // Send to specific patch via messnamed
    messnamed("mcp_client_" + patch_id, msg_type, json_str);

    log_info("Routed " + msg_type + " to " + patch_id);
}

function determine_message_type(data) {
    return data.request_id ? MSG_TYPE_REQUEST : MSG_TYPE_COMMAND;
}

// ========================================
// GLOBAL COMMAND HANDLERS
// ========================================

// Handle list_registered_patches request
function handle_list_registered_patches(request_id) {
    var patch_list = get_registered_patch_list();

    var response = {
        request_id: request_id,
        results: patch_list
    };

    forward_response_to_node(JSON.stringify(response));
    log_info("Sent list of " + patch_list.length + " registered patches");
}

// ========================================
// DEBUG FUNCTIONS
// ========================================

// List registered patches (for debugging)
function list_patches() {
    post("mcp-router: Registered patches:\n");
    var patch_list = get_registered_patch_list();
    for (var i = 0; i < patch_list.length; i++) {
        post("  - " + patch_list[i] + "\n");
    }
}

// ========================================
// LOGGING UTILITIES
// ========================================

function log_info(message) {
    post("mcp-router: " + message + "\n");
}

function log_warn(message) {
    post("mcp-router: WARNING - " + message + "\n");
}

function log_error(message) {
    post("mcp-router: ERROR - " + message + "\n");
}

function log_debug(message) {
    post("mcp-router: " + message + "\n");
}
