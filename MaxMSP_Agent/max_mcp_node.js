// max_mcp_node.js
// Socket.IO server that bridges Max/MSP and Python MCP server
// Handles bidirectional communication and patch registration

autowatch = 1;

// Uncomment the line below to enable debugger breakpoint on start
// debugger;

// ========================================
// DEPENDENCIES
// ========================================

const Max = require("max-api");
const { Server } = require("socket.io");

// ========================================
// CONFIGURATION
// ========================================

var PORT = 5002;
const NAMESPACE = "/mcp";
const MIN_PORT = 1;
const MAX_PORT = 65535;

// ========================================
// STATE VARIABLES
// ========================================

// Track registered patches: { patch_id: socket_id }
var registered_patches = {};

// Socket.IO server instance
var io = create_socket_server(PORT);

// ========================================
// SERVER INITIALIZATION
// ========================================

function create_socket_server(port) {
  return new Server(port, {
    cors: { origin: "*" }
  });
}

function restart_socket_server(new_port) {
  PORT = new_port;
  io.close();
  io = create_socket_server(PORT);
  setup_socket_handlers();
  Max.outlet("port", `Server listening on port ${PORT}`);
}

// Initialize server
Max.outlet("port", `Server listening on port ${PORT}`);

// ========================================
// UTILITY FUNCTIONS
// ========================================

function safe_parse_json(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    Max.post("error, Invalid JSON: " + e.message);
    Max.post("This is likely because the patcher has too much objects, select some of them and try again");
    return null;
  }
}

function is_valid_port(port) {
  return port > MIN_PORT && port < MAX_PORT;
}

function log_info(message) {
  Max.post(message);
}

function log_warn(message) {
  Max.post("Warning: " + message);
}

// ========================================
// MAX HANDLER REGISTRATION
// ========================================

// Handle responses from mcp-router via send/receive
Max.addHandler("response", async (...msg) => {
  log_info(`response handler called with ${msg.length} args\n`);
  var json_str = msg.join("");
  log_info(`response: joined string length=${json_str.length}\n`);

  var data = safe_parse_json(json_str);
  if (data) {
    await emit_response(data);
    log_info(`response: Emitted to Socket.IO for request_id=${data.request_id}\n`);
  } else {
    log_info(`response: Failed to parse JSON\n`);
  }
});

// Handle port change requests
Max.addHandler("port", async (msg) => {
  log_info(`msg ${msg}`);
  if (is_valid_port(msg)) {
    await restart_socket_server(msg);
  }
});

// Handle patch registration from mcp-router
Max.addHandler("mcp_router_register", async (patch_id) => {
  registered_patches[patch_id] = true;
  await emit_patch_registered(patch_id);
  log_info(`mcp_router_register: ${patch_id} registered and broadcasted`);
});

// Handle patch unregistration from mcp-router
Max.addHandler("mcp_router_unregister", async (patch_id) => {
  delete registered_patches[patch_id];
  await emit_patch_unregistered(patch_id);
  log_info(`mcp_router_unregister: ${patch_id} unregistered and broadcasted`);
});

// Handle responses from mcp-client via messnamed (legacy)
Max.addHandler("mcp_response", async (json_str) => {
  log_info(`mcp_response received: ${json_str.substring(0, 100)}...\n`);
  var data = safe_parse_json(json_str);
  if (data) {
    await emit_response(data);
    log_info(`mcp_response: Forwarded response for request_id=${data.request_id}\n`);
  } else {
    log_info(`mcp_response: Failed to parse JSON\n`);
  }
});

// Handle responses from mcp-client via send/receive
Max.addHandler("mcp_client_response", async (...args) => {
  log_info(`mcp_client_response received with ${args.length} args\n`);

  if (!is_valid_mcp_client_response(args)) {
    log_info(`mcp_client_response: Unexpected args format\n`);
    return;
  }

  var json_str = args.slice(1).join("");
  log_info(`mcp_client_response: json length=${json_str.length}\n`);

  var data = safe_parse_json(json_str);
  if (data) {
    await emit_response(data);
    log_info(`mcp_client_response: Forwarded response for request_id=${data.request_id}\n`);
  } else {
    log_info(`mcp_client_response: Failed to parse JSON\n`);
  }
});

function is_valid_mcp_client_response(args) {
  return args.length >= 2 && args[0] === "response";
}

// ========================================
// SOCKET.IO EVENT EMISSION
// ========================================

async function emit_response(data) {
  await io.of(NAMESPACE).emit("response", data);
}

async function emit_patch_registered(patch_id) {
  await io.of(NAMESPACE).emit("patch_registered", { patch_id: patch_id });
}

async function emit_patch_unregistered(patch_id) {
  await io.of(NAMESPACE).emit("patch_unregistered", { patch_id: patch_id });
}

// ========================================
// SOCKET.IO CONNECTION HANDLERS
// ========================================

function setup_socket_handlers() {
  io.of(NAMESPACE).on("connection", handle_socket_connection);
}

function handle_socket_connection(socket) {
  log_info(`Socket.IO client connected: ${socket.id}`);

  // Setup all event handlers
  socket.on("register_patch", (data) => handle_patch_registration(socket, data));
  socket.on("unregister_patch", (data) => handle_patch_unregistration(data));
  socket.on("command", (data) => handle_command(data));
  socket.on("request", (data) => handle_request(data));
  socket.on("response", (data) => handle_response(data));
  socket.on("port", (data) => handle_port_change(data));
  socket.on("disconnect", () => handle_disconnect(socket));
}

// ========================================
// SOCKET EVENT HANDLERS
// ========================================

function handle_patch_registration(socket, data) {
  if (data && data.patch_id) {
    registered_patches[data.patch_id] = socket.id;
    log_info(`Patch registered: ${data.patch_id} (socket: ${socket.id})`);
  }
}

function handle_patch_unregistration(data) {
  if (data && data.patch_id) {
    delete registered_patches[data.patch_id];
    log_info(`Patch unregistered: ${data.patch_id}`);
  }
}

function handle_command(data) {
  if (data && data.patch_id) {
    Max.outlet("command", JSON.stringify(data));
  } else {
    log_warn("command without patch_id received");
  }
}

function handle_request(data) {
  log_info(`handle_request called: ${JSON.stringify(data).substring(0, 100)}`);
  if (data && data.patch_id) {
    Max.outlet("request", JSON.stringify(data));
    log_info(`Forwarded request to mcp-router for patch_id=${data.patch_id}`);
  } else {
    log_warn("request without patch_id received");
  }
}

async function handle_response(data) {
  await emit_response(data);
}

async function handle_port_change(data) {
  log_info(`msg ${data}`);
  if (is_valid_port(data)) {
    await restart_socket_server(data);
  }
}

function handle_disconnect(socket) {
  log_info(`Socket.IO client disconnected: ${socket.id}`);
  unregister_patches_by_socket(socket.id);
}

function unregister_patches_by_socket(socket_id) {
  for (var patch_id in registered_patches) {
    if (registered_patches[patch_id] === socket_id) {
      delete registered_patches[patch_id];
      log_info(`Auto-unregistered patch: ${patch_id}`);
    }
  }
}

// ========================================
// INITIALIZE SOCKET HANDLERS
// ========================================

setup_socket_handlers();
