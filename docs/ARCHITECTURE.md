# System Architecture

## Overview

MaxMSP-MCP implements a multi-patch control system using the Model Context Protocol (MCP). The architecture enables LLMs to control multiple Max/MSP patches simultaneously through a centralized routing system.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│                      (MCP Client)                                │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP Protocol (stdio)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Python MCP Server                              │
│                    (server.py)                                   │
│  • MCPツール関数（patch_id対応）                                  │
│  • Socket.IOクライアント                                          │
│  • 登録済みパッチ管理                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ Socket.IO (port 5002, /mcp namespace)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Max/MSP - demo.maxpat (Central Hub)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [p MaxMSP_Agent] subpatch                               │   │
│  │    ├── [node.script max_mcp_node.js]                     │   │
│  │    │   • Socket.IOサーバー起動                            │   │
│  │    │   • Python接続管理                                   │   │
│  │    │                                                      │   │
│  │    └── [js max_mcp.js]                                   │   │
│  │        • Socket.IO ↔ Max bridge                          │   │
│  │        • patch_id検出と転送                               │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │ messnamed("mcp_router_inlet")        │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [receive mcp_router_inlet]                              │   │
│  │         ↓                                                │   │
│  │  [js mcp-router.js]                                      │   │
│  │    • 中央ルーター                                          │   │
│  │    • パッチ登録管理                                         │   │
│  │    • patch_id別メッセージ振り分け                          │   │
│  └───────────────────────┬──────────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────────┘
                           │ messnamed("mcp_client_<patch_id>")
                           ▼
        ┌──────────────────────────────────────────┐
        │  User Patch A (e.g., synth.maxpat)       │
        │  ┌────────────────────────────────────┐  │
        │  │ [receive mcp_client_synth]         │  │
        │  │         ↓ (dynamically created)    │  │
        │  │ [js mcp_client.js synth]           │  │
        │  │   • this.patcher操作               │  │
        │  │   • オブジェクト追加/削除            │  │
        │  │   • 接続/切断                       │  │
        │  └────────────────────────────────────┘  │
        └──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────┐
        │  User Patch B (e.g., fx.maxpat)         │
        │  ┌────────────────────────────────────┐  │
        │  │ [receive mcp_client_fx]            │  │
        │  │         ↓ (dynamically created)    │  │
        │  │ [js mcp_client.js fx]              │  │
        │  └────────────────────────────────────┘  │
        └──────────────────────────────────────────┘
```

## Communication Layers

### Layer 1: MCP Protocol (Claude Code ↔ Python)

**Protocol**: stdio-based JSON-RPC
**Transport**: Standard input/output
**Direction**: Bidirectional

**Responsibilities**:
- Tool invocation from Claude Code
- Response delivery to Claude Code
- Error handling and timeout management

**Example Tool Call**:
```json
{
  "tool": "add_max_object",
  "arguments": {
    "patch_id": "synth",
    "position": [200, 300],
    "obj_type": "cycle~",
    "varname": "osc1",
    "args": [440]
  }
}
```

### Layer 2: Socket.IO (Python ↔ Max/MSP)

**Protocol**: Socket.IO over HTTP
**Port**: 5002
**Namespace**: `/mcp`
**Direction**: Bidirectional

**Python → Max Events**:
- `command` - Non-blocking commands
- `request` - Blocking requests (with UUID, expects response)

**Max → Python Events**:
- `response` - Response to requests
- `patch_registered` - Patch registration notification
- `patch_unregistered` - Patch unregistration notification

**Example Command**:
```javascript
{
  "action": "add_object",
  "patch_id": "synth",
  "position": [200, 300],
  "obj_type": "cycle~",
  "varname": "osc1",
  "args": [440]
}
```

### Layer 3: Max Internal (max_mcp_node.js → mcp-router.js)

**Protocol**: Max send/receive
**Message Path**: `[route request/command]` → `[send mcp_router_inlet]` → `[receive mcp_router_inlet]`
**Direction**: Unidirectional (node.script → mcp-router.js)

**Implementation in [p MaxMSP-Agent] subpatch**:
```
[node.script max_mcp_node.js]
    ↓ outlet 0
[route request]  [route command]  [route running]
    ↓                ↓
[send mcp_router_inlet]
```

**Responsibilities**:
- Forward Socket.IO messages from Node.js to router
- Route by message type (request/command/running)

**Important**: The `[route]` objects extract the message type, and both `request` and `command` outputs connect to `[send mcp_router_inlet]` to forward messages to the router.

### Layer 4: Router Distribution (mcp-router.js ↔ mcp_client.js)

**Protocol**: Max messnamed + send/receive
**Message Name Pattern**: `mcp_client_<patch_id>`
**Direction**: Bidirectional

**Router → Client**:
```javascript
messnamed("mcp_client_synth", "command", json_str)
```

**Client → Router** (responses):
```javascript
messnamed("mcp_response", JSON.stringify(response))
```

### Layer 5: Patch Manipulation (mcp_client.js ↔ this.patcher)

**Protocol**: Max JavaScript API
**Direction**: Client → Patcher

**Operations**:
- `this.patcher.newdefault(...)` - Add objects
- `this.patcher.remove(...)` - Remove objects
- `this.patcher.connect(...)` - Create patchcords
- `this.patcher.disconnect(...)` - Remove patchcords
- `this.patcher.getnamed(...)` - Get objects by varname

## Key Components

### Python Side: server.py

**Role**: MCP Server implementation

**Key Features**:
- All tool functions accept `patch_id` parameter
- Socket.IO client for Max/MSP communication
- Request/response pattern with UUID tracking
- Patch registration tracking

**Main Class**: `MaxMSPConnection`
```python
class MaxMSPConnection:
    def __init__(self):
        self.sio = socketio.AsyncClient()
        self.registered_patches = set()
        self._pending = {}  # UUID → asyncio.Future

    async def send_command(self, data):
        # Non-blocking command
        await self.sio.emit("command", data, namespace="/mcp")

    async def send_request(self, data, timeout=2.0):
        # Blocking request with response
        request_id = str(uuid.uuid4())
        data["request_id"] = request_id
        future = asyncio.Future()
        self._pending[request_id] = future
        await self.sio.emit("request", data, namespace="/mcp")
        return await asyncio.wait_for(future, timeout=timeout)
```

### Max/MSP Side: max_mcp_node.js

**Role**: Socket.IO server in Max

**Key Features**:
- Node.js Socket.IO server on port 5002
- Bridge between Socket.IO and Max JavaScript
- Handle patch registration events

**Key Handlers**:
```javascript
// Socket.IO → Max
socket.on("command", async (data) => {
    Max.outlet("command", JSON.stringify(data));
});

// Max → Socket.IO
Max.addHandler("mcp_router_register", async (patch_id) => {
    await io.of(NAMESPACE).emit("patch_registered", { patch_id });
});
```

### Max/MSP Side: max_mcp.js

**Role**: Socket.IO ↔ Max bridge

**Key Features**:
- Receive from node.script (max_mcp_node.js)
- Detect patch_id in messages
- Forward to mcp-router.js via messnamed

**Key Logic**:
```javascript
function anything() {
    var msg = arrayfromargs(messagename, arguments).join(" ");
    var data = safe_parse_json(msg);

    if (data.patch_id) {
        // Forward to router
        messnamed("mcp_router_inlet", msg);
        return;
    }

    // Legacy single-patch mode
    // ... handle directly
}
```

### Max/MSP Side: mcp-router.js

**Role**: Central routing hub

**Key Features**:
- Maintain registered patches
- Route messages by patch_id
- Handle registration/unregistration
- Forward responses from clients back to Node.js

**Key Functions**:
```javascript
var registered_patches = {};

function mcp_register(patch_id) {
    registered_patches[patch_id] = true;
    outlet(0, "mcp_router_register", patch_id);
    post("mcp-router: ✓ Registered patch_id=" + patch_id + "\n");
}

function anything() {
    var data = safe_parse_json(arguments[0]);
    var patch_id = data.patch_id;

    if (!registered_patches[patch_id]) {
        post("mcp-router: Patch not registered: " + patch_id + "\n");
        return;
    }

    // Route to specific client
    messnamed("mcp_client_" + patch_id, msg_type, json_str);
}

// Handle responses from mcp-client.js via [send/receive mcp_router_events]
function response() {
    var json_str = arrayfromargs(arguments).join(" ");
    forward_response_to_node(json_str);
    log_info("Forwarded response to node");
}
```

**Response Flow**: When mcp-client.js sends a response via `[send mcp_router_events]`, it is received by mcp-router.js's `response()` function, which forwards it to max_mcp_node.js for transmission back to Python.

### Max/MSP Side: mcp_client.js

**Role**: Per-patch controller

**Key Features**:
- One instance per patch (identified by patch_id)
- Dynamically create `[receive mcp_client_<patch_id>]`
- Operate on `this.patcher`

**Key Functions**:
```javascript
var my_patch_id;
var p = this.patcher;

function loadbang() {
    my_patch_id = String(jsarguments[1]).replace(/#\d+$/, "");

    // Create dynamic receiver
    var receiver_name = "mcp_client_" + my_patch_id;
    var receive_obj = p.newdefault(10, 10, "receive", receiver_name);

    // Connect to this js object
    p.connect(receive_obj, 0, this.box, 0);

    // Register with router
    messnamed("mcp_register", my_patch_id);
}

function anything() {
    var json_str = arguments[0];
    var data = safe_parse_json(json_str);

    // Execute action on this.patcher
    switch (data.action) {
        case "add_object":
            var obj = p.newdefault(...);
            obj.varname = data.varname;
            break;
        // ... other actions
    }
}
```

## Data Flow Examples

### Example 1: Add Object

```
1. Claude Code:
   add_max_object(patch_id="synth", position=[200,300], obj_type="cycle~", varname="osc1", args=[440])

2. Python server.py:
   await connection.send_command({
       "action": "add_object",
       "patch_id": "synth",
       "position": [200, 300],
       "obj_type": "cycle~",
       "varname": "osc1",
       "args": [440]
   })

3. Socket.IO → Max:
   Event: "command"
   Data: {action: "add_object", patch_id: "synth", ...}

4. max_mcp_node.js:
   Max.outlet("command", JSON.stringify(data))

5. max_mcp.js:
   messnamed("mcp_router_inlet", JSON.stringify(data))

6. mcp-router.js:
   messnamed("mcp_client_synth", "command", JSON.stringify(data))

7. mcp_client.js (in synth.maxpat):
   p.newdefault(200, 300, "cycle~", 440)
   obj.varname = "osc1"

8. Result:
   cycle~ object appears in synth.maxpat
```

### Example 2: Patch Registration

```
1. User opens synth.maxpat with [js mcp_client.js synth]

2. mcp_client.js loadbang():
   messnamed("mcp_register", "synth")

3. mcp-router.js:
   registered_patches["synth"] = true
   outlet(0, "mcp_router_register", "synth")

4. [send mcp_router_events] → [receive mcp_router_events]

5. max_mcp_node.js:
   await io.emit("patch_registered", {patch_id: "synth"})

6. Python server.py:
   @sio.on("patch_registered")
   registered_patches.add("synth")

7. Result:
   list_registered_patches() → ["synth"]
```

## Design Principles

### 1. Direct JS Object (No Abstraction)

**Important**: Always use `[js mcp_client.js patch_id]` directly in patches, **not** abstractions like `[mcp-client patch_id]`.

**Reason**: When using an abstraction, `this.patcher` refers to the abstraction's internal patcher, not the user patch. This causes objects to be created inside the abstraction (invisible to the user) instead of the target patch.

**Correct Usage**:
```
test1.maxpat:
├── [js mcp_client.js test1]  ✓ Objects added to test1.maxpat
```

**Incorrect Usage**:
```
test1.maxpat:
├── [mcp-client test1]  ✗ Objects added inside mcp-client abstraction
    └── (internal patcher)
```

### 2. patch_id-Based Routing

Each patch is uniquely identified by a string `patch_id`. This enables:
- Precise targeting of operations
- Multiple patches open simultaneously
- No ambiguity about which patch to modify

### 3. Dynamic Registration

Patches register themselves on loadbang:
- No manual configuration needed
- Automatic discovery
- Graceful handling of patch open/close

### 4. messnamed Communication

Max's `messnamed()` enables global message passing:
- Cross-patch communication
- No outlet/inlet connections needed
- Flexible routing topology

### 5. Patcher Scope Limitation

JavaScript's `this.patcher` only accesses the patcher where js object resides:
- Enforces separation of concerns
- Each client controls only its own patch
- No accidental cross-patch manipulation

### 6. Request/Response Pattern

Blocking operations use UUID-based request tracking:
- Python waits for Max response
- Timeout protection (default 2 seconds)
- Error propagation to Claude Code

## Scalability Considerations

### Current Limits

- **Patches**: Tested with 2-5 simultaneous patches
- **Objects per operation**: < 100 recommended
- **JSON message size**: Max string limit (~32KB per message)
- **Socket.IO connections**: 3 typical (2 patches + Python)

### Performance

- **Localhost latency**: < 1ms
- **JSON parsing**: Negligible overhead
- **Operation latency**: 10-50ms end-to-end
- **Max JS execution**: Synchronous, blocks Max thread

### Future Improvements

- Connection pooling for many patches
- Message batching for bulk operations
- Async operation queuing
- Performance monitoring and metrics

## Security Considerations

### Current Model

- **Localhost only**: Socket.IO binds to 127.0.0.1
- **No authentication**: Trust localhost environment
- **No encryption**: Plain Socket.IO (HTTP)

### Future Enhancements

- Optional authentication token
- TLS/SSL support for Socket.IO
- Rate limiting per patch_id
- Command whitelisting/blacklisting

## Error Handling

### Timeout Errors

Python requests timeout after 2 seconds if Max doesn't respond.

**Causes**:
- Max patch not responding
- JavaScript error in client
- Patch not registered

### Connection Errors

Socket.IO connection failures are logged and retried.

**Causes**:
- Max not running
- Port 5002 occupied
- Firewall blocking

### JavaScript Errors

Errors in Max JavaScript are logged to Max Console.

**Handling**:
- Try/catch in all operation functions
- Error responses sent back to Python
- Graceful degradation

## Related Documents

- [Setup Guide](SETUP.md) - Installation and configuration
- [Usage Guide](USAGE.md) - How to use the system
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Specification](SPECIFICATION.md) - Technical details
