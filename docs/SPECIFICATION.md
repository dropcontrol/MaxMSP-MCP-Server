# MaxMSP-MCP Server Multi-Patch Edition Specification

**Version**: 1.0.0
**Last Updated**: 2025-10-13

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Communication Protocol](#communication-protocol)
4. [Component Specifications](#component-specifications)
5. [API Specification](#api-specification)
6. [Data Formats](#data-formats)
7. [Error Handling](#error-handling)
8. [Security](#security)
9. [Performance](#performance)
10. [Testing](#testing)

---

## Overview

### Project Purpose

MaxMSP-MCP Server is a system that enables Large Language Models (LLMs) to directly understand, generate, and manipulate Max/MSP patches using the Model Context Protocol (MCP). This specification describes the multi-patch edition.

### Key Features

- **Patch Understanding**: LLMs analyze Max/MSP patch structures and objects
- **Patch Generation**: LLMs create and connect Max/MSP objects
- **Patch Manipulation**: Modify attributes, delete objects, manage connections
- **Multi-Patch Support**: Simultaneously manage and operate multiple patches
- **Documentation Access**: Access official Max/MSP object documentation

### System Requirements

- **Max/MSP**: Version 9 or later (JavaScript V8 engine required)
- **Python**: 3.8 or later
- **Node.js**: npm execution environment
- **OS**: macOS, Windows, Linux

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM (MCP Client)                          │
│               (Claude Desktop, Cursor, etc.)                │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
                      │ (stdio/SSE)
┌─────────────────────▼───────────────────────────────────────┐
│              Python MCP Server (server.py)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MaxMSPConnection (Socket.IO Client)                  │  │
│  │ - send_request() / send_command()                    │  │
│  │ - _pending: {request_id -> Future}                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ Socket.IO
                      │ Port: 5002
                      │ Namespace: /mcp
┌─────────────────────▼───────────────────────────────────────┐
│         Node.js Socket.IO Server (max_mcp_node.js)          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ registered_patches: {patch_id -> socket_id}          │  │
│  │ Events: command, request, response                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ messnamed
                      │ (Max send/receive)
┌─────────────────────▼───────────────────────────────────────┐
│              mcp-router.js (Message Router)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ registered_patches: {patch_id -> true}               │  │
│  │ Routes messages to mcp-client instances              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ messnamed
                      │ mcp_client_{patch_id}
        ┌─────────────┼─────────────┬─────────────┐
        │             │             │             │
┌───────▼─────┐ ┌────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
│mcp_client.js│ │mcp_client │ │mcp_client │ │mcp_client │
│  (patch1)   │ │  (patch2) │ │  (patch3) │ │   (...)   │
└───────┬─────┘ └────┬──────┘ └────┬──────┘ └────┬──────┘
        │            │             │             │
┌───────▼────────────▼─────────────▼─────────────▼──────────┐
│              Max JavaScript API (this.patcher)             │
│         Max/MSP Patches (Multiple patches managed)         │
└────────────────────────────────────────────────────────────┘
```

### Layer Architecture

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **Application Layer** | LLM (MCP Client) | User interface, natural language processing |
| **Protocol Layer** | Python MCP Server | MCP protocol implementation, request management |
| **Transport Layer** | Socket.IO (max_mcp_node.js) | Bidirectional communication, event management |
| **Routing Layer** | mcp-router.js | Patch ID-based message routing |
| **Agent Layer** | mcp_client.js | Patch operations, state management |
| **API Layer** | Max JavaScript API | Direct access to Max/MSP patches |

---

## Communication Protocol

### MCP Protocol (LLM ↔ Python)

- **Protocol**: Model Context Protocol over stdio/SSE
- **Data Format**: JSON-RPC 2.0
- **Direction**: Bidirectional (requests from LLM, responses from server)

### Socket.IO (Python ↔ Max/MSP)

#### Connection Specification

- **URL**: `http://127.0.0.1:5002` (configurable via environment variables)
- **Namespace**: `/mcp`
- **Transport**: WebSocket + Long Polling (fallback)
- **CORS**: All origins allowed (development mode)

#### Event Specification

| Event Name | Direction | Description | Payload |
|-----------|-----------|-------------|---------|
| `command` | Python → Max | Fire-and-forget command | `{patch_id, action, ...params}` |
| `request` | Python → Max | Request requiring response | `{patch_id, action, request_id, ...params}` |
| `response` | Max → Python | Response to request | `{request_id, patch_id, results}` |
| `patch_registered` | Max → Python | Patch registration notification | `{patch_id}` |
| `patch_unregistered` | Max → Python | Patch unregistration notification | `{patch_id}` |

### Max Internal Communication

#### messnamed Communication

- **mcp_register**: Patch registration request
- **mcp_unregister**: Patch unregistration request
- **mcp_reply**: Response reply
- **mcp_client_{patch_id}**: Message to specific patch
- **mcp_router_events**: Events to router

#### send/receive Communication

- **send mcp_router_events**: Client to router
- **receive mcp_client_{patch_id}**: Router to client

---

## Component Specifications

### 1. Python MCP Server (server.py)

#### Responsibilities

- MCP protocol implementation
- Communication with Max/MSP as Socket.IO client
- Request/response management
- Documentation database provision

#### Main Classes

**MaxMSPConnection**

```python
class MaxMSPConnection:
    def __init__(self, server_url: str, port: int, namespace: str)
    async def connect() -> None
    async def disconnect() -> None
    async def send_command(patch_id: str, action: str, **params) -> None
    async def send_request(patch_id: str, action: str, timeout: float, **params) -> dict
    def _handle_response(data: dict) -> None
```

**Main Methods**

- `send_command()`: Async command sending (no response required)
- `send_request()`: Sync request sending (waits for response, uses UUID)
- `_handle_response()`: Response handler (resolves Future)

#### State Management

```python
_pending: Dict[str, asyncio.Future]  # {request_id -> Future}
io_server_started: bool              # Socket.IO connection state
```

#### Environment Variables

| Variable Name | Default Value | Description |
|--------------|---------------|-------------|
| `SOCKETIO_SERVER_URL` | `http://127.0.0.1` | Socket.IO server URL |
| `SOCKETIO_SERVER_PORT` | `5002` | Socket.IO server port |
| `NAMESPACE` | `/mcp` | Socket.IO namespace |

---

### 2. Node.js Socket.IO Server (max_mcp_node.js)

#### Responsibilities

- Relay Socket.IO communication between Python and Max/MSP
- Manage patch registration information
- Broadcast events

#### Configuration

```javascript
const PORT = 5002;
const NAMESPACE = "/mcp";
const MIN_PORT = 1;
const MAX_PORT = 65535;
```

#### State Management

```javascript
registered_patches: {
  [patch_id: string]: socket_id | true
}
```

#### Event Handlers

| Max Handler | Description | Processing |
|------------|-------------|------------|
| `response` | Response from mcp-router | Forward to Python via Socket.IO |
| `mcp_router_register` | Patch registration notification | Broadcast `patch_registered` event |
| `mcp_router_unregister` | Patch unregistration notification | Broadcast `patch_unregistered` event |
| `port` | Port change request | Restart server |

#### Socket.IO Event Handlers

| Event | Description | Processing |
|-------|-------------|------------|
| `connection` | Client connected | Register event handlers |
| `disconnect` | Client disconnected | Unregister all patches with this socket_id |
| `command` | Command received | Forward to Max outlet |
| `request` | Request received | Forward to Max outlet |

---

### 3. Message Router (mcp-router.js)

#### Responsibilities

- Route messages between max_mcp_node.js and mcp_client.js
- Distribute messages based on patch ID
- Handle global commands

#### State Management

```javascript
registered_patches: {
  [patch_id: string]: true
}
```

#### Routing Logic

```
1. Receive JSON message via inlet
2. Parse JSON
3. Check for global command
   - action="list_registered_patches" AND request_id exists
   → Process with global handler
4. Validate patch_id
   - No patch_id → Warning log, exit
   - Unregistered patch_id → Warning log, exit
5. Determine message type
   - request_id exists → "request"
   - No request_id → "command"
6. Send to specific patch via messnamed
   messnamed("mcp_client_{patch_id}", msg_type, json_str)
```

#### Global Commands

| Action | Description | Response |
|--------|-------------|----------|
| `list_registered_patches` | Get list of registered patch IDs | `{request_id, results: [patch_id, ...]}` |

---

### 4. MCP Client (mcp_client.js)

#### Responsibilities

- Agent placed in each patch
- Execute patch operations
- Retrieve patch state
- Access Max JavaScript API

#### Initialization Process

```javascript
loadbang() {
  1. initialize_patch_id()     // Get patch_id from jsarguments
  2. setup_receiver()           // Create [receive mcp_client_{patch_id}]
  3. setup_sender()             // Create [send mcp_router_events]
  4. register_with_router()     // messnamed("mcp_register", patch_id)
}
```

#### Excluded Objects

Objects with the following varname prefixes are excluded from queries:

- `maxmcpid-*`: Internal management
- `mcp-client-*`: MCP infrastructure objects

#### Main Function Groups

**Patch Manipulation Functions**

| Function Name | Description | Parameters |
|--------------|-------------|------------|
| `add_object()` | Add object | x, y, type, args, varname |
| `remove_object()` | Remove object | varname |
| `connect_objects()` | Connect objects | src_varname, outlet_idx, dst_varname, inlet_idx |
| `disconnect_objects()` | Disconnect objects | src_varname, outlet_idx, dst_varname, inlet_idx |
| `set_object_attribute()` | Set attribute | varname, attr_name, attr_value |
| `set_message_text()` | Set message object text | varname, new_text |
| `send_message_to_object()` | Send message | varname, message |
| `send_bang_to_object()` | Send bang message | varname |
| `set_number()` | Set number | varname, num |

**Query Functions**

| Function Name | Description | Return Value |
|--------------|-------------|--------------|
| `get_objects_in_patch()` | Get all objects in patch | `{boxes: [...], lines: [...]}` |
| `get_objects_in_selected()` | Get selected objects | `{boxes: [...], lines: [...]}` |
| `get_object_attributes()` | Get object attributes | `{attr_name: value, ...}` |
| `get_avoid_rect_position()` | Get object placement area | `[left, top, right, bottom]` |

---

## API Specification

### MCP Tools (Functions callable from LLM)

#### Patch Management

**list_registered_patches()**

Get list of registered patch IDs

- **Parameters**: None
- **Returns**: `List[str]` - List of patch IDs
- **Example**:
  ```python
  ["test1", "test2", "synth"]
  ```

---

#### Object Manipulation

**add_max_object(patch_id, position, obj_type, varname, args)**

Add a Max/MSP object

- **Parameters**:
  - `patch_id` (str): Target patch ID
  - `position` (List[int]): `[x, y]` coordinates
  - `obj_type` (str): Object type (e.g., "cycle~", "dac~")
  - `varname` (str): Unique variable name
  - `args` (List): Object arguments (optional)
- **Returns**: `{"status": "success", "varname": str}`
- **Example**:
  ```python
  add_max_object(
    patch_id="synth",
    position=[100, 150],
    obj_type="cycle~",
    varname="osc1",
    args=[440]
  )
  ```

**remove_max_object(patch_id, varname)**

Remove an object

- **Parameters**:
  - `patch_id` (str): Target patch ID
  - `varname` (str): Variable name of object to remove
- **Returns**: `{"status": "success"}`

**connect_max_objects(patch_id, src_varname, outlet_idx, dst_varname, inlet_idx)**

Connect two objects

- **Parameters**:
  - `patch_id` (str): Target patch ID
  - `src_varname` (str): Source object variable name
  - `outlet_idx` (int): Source outlet index
  - `dst_varname` (str): Destination object variable name
  - `inlet_idx` (int): Destination inlet index
- **Returns**: `{"status": "success"}`

**disconnect_max_objects(patch_id, src_varname, outlet_idx, dst_varname, inlet_idx)**

Disconnect two objects

- **Parameters**: Same as `connect_max_objects()`
- **Returns**: `{"status": "success"}`

**set_object_attribute(patch_id, varname, attr_name, attr_value)**

Set object attribute

- **Parameters**:
  - `patch_id` (str): Target patch ID
  - `varname` (str): Object variable name
  - `attr_name` (str): Attribute name
  - `attr_value` (List): Attribute value (array format)
- **Returns**: `{"status": "success"}`

---

#### Patch Information Retrieval

**get_objects_in_patch(patch_id)**

Get all objects and connections in patch

- **Parameters**:
  - `patch_id` (str): Target patch ID
- **Returns**:
  ```python
  {
    "boxes": [
      {
        "box": {
          "maxclass": "cycle~",
          "varname": "osc1",
          "patching_rect": [100, 150, 50, 22]
        }
      },
      ...
    ],
    "lines": [
      {
        "patchline": {
          "source": ["osc1", 0],
          "destination": ["dac1", 0]
        }
      },
      ...
    ]
  }
  ```

**get_avoid_rect_position(patch_id)**

Get area occupied by existing objects (used for placing new objects)

- **Parameters**:
  - `patch_id` (str): Target patch ID
- **Returns**: `[left, top, right, bottom]`
- **Example**: `[10, 10, 500, 400]`

---

#### Documentation Reference

**list_all_objects()**

Get list of all Max/MSP object names

- **Parameters**: None
- **Returns**: `List[str]` - List of object names
- **Example**: `["cycle~", "dac~", "metro", ...]`

**get_object_doc(object_name)**

Get official documentation for specific object

- **Parameters**:
  - `object_name` (str): Object name
- **Returns**:
  ```python
  {
    "digest": "Brief description",
    "description": "Detailed description",
    "inlets": [{"description": "inlet description", ...}],
    "outlets": [{"description": "outlet description", ...}],
    "arguments": [...],
    "messages": [...],
    "attributes": [...]
  }
  ```

---

## Data Formats

### Request Message

```json
{
  "action": "add_object",
  "patch_id": "synth",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "position": [100, 150],
  "obj_type": "cycle~",
  "varname": "osc1",
  "args": [440]
}
```

### Response Message

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "patch_id": "synth",
  "results": {
    "status": "success",
    "varname": "osc1"
  }
}
```

### Patch Object Data

```json
{
  "boxes": [
    {
      "box": {
        "maxclass": "cycle~",
        "varname": "osc1",
        "patching_rect": [100, 150, 50, 22]
      }
    }
  ],
  "lines": [
    {
      "patchline": {
        "source": ["osc1", 0],
        "destination": ["dac1", 0]
      }
    }
  ]
}
```

---

## Error Handling

### Error Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Connection Error** | Connection failure | Socket.IO connection failed |
| **Timeout Error** | Timeout | No response within 2 seconds |
| **Validation Error** | Parameter validation error | Missing patch_id, duplicate varname |
| **Not Found Error** | Resource not found | Non-existent patch_id, varname |
| **JSON Parse Error** | JSON parsing error | Invalid JSON string |

### Error Response Format

```json
{
  "request_id": "uuid",
  "patch_id": "synth",
  "error": "Object not found: osc1"
}
```

### Error Handling Strategy

1. **Python Side**:
   - Timeout: 2 seconds (`send_request`)
   - Not connected: Throw exception
   - JSON parse error: Log output, return null

2. **Max/MSP Side**:
   - JSON parse error: Error log, skip processing
   - Object not found: Error log, return error response
   - Attribute not supported: Log output, skip processing

---

## Security

### Current Implementation

- **Socket.IO CORS**: All origins allowed (development mode)
- **Authentication**: None
- **Encryption**: None (localhost communication assumed)

### Recommendations (Production Environment)

1. **CORS Restriction**: Allow specific origins only
2. **Authentication Token**: Verify token on Socket.IO connection
3. **TLS/SSL**: Use encrypted communication in production
4. **Input Validation**: Sanitize all parameters

---

## Performance

### Timeout Settings

| Operation | Timeout | Location |
|-----------|---------|----------|
| Request sending | 2 seconds | `server.py:send_request()` |
| Socket.IO connection | None | `socketio.AsyncClient()` |

### Optimization

- **Long JSON strings**: Split with `split_long_string()` (workaround for Max/MSP string length limit)
- **Object collection**: Recursive collection with `applydeep()`
- **Exclusion filter**: Pre-filter MCP infrastructure objects

### Scalability

- **Multiple patches**: Theoretically unlimited (memory-dependent)
- **Concurrent requests**: asyncio async processing
- **Socket.IO connection**: Single connection (shared by all patches)

---

## Testing

### Unit Tests

- **Framework**: Vitest
- **Coverage**: 61 tests
- **Files**:
  - `test/mcp_client.test.js` (20 tests)
  - `test/mcp-router.test.js` (20 tests)
  - `test/max_mcp_node.test.js` (21 tests)

### E2E Tests

- **Documentation**: `test/E2E_TEST_GUIDE.md`
- **Test Scenarios**: 9 scenarios
- **Execution Method**: Collaborative testing between user and Claude

### Test Execution

```bash
# Run unit tests
cd MaxMSP_Agent
npm test

# Generate coverage report
npm run test:coverage

# View tests in UI
npm run test:ui
```

---

## Appendix

### Glossary

| Term | Description |
|------|-------------|
| **MCP** | Model Context Protocol - Communication protocol between LLMs and tools |
| **patch_id** | Unique identifier for Max/MSP patch |
| **varname** | Script variable name for Max/MSP object |
| **patching_rect** | Coordinates and size of Max/MSP object `[x, y, w, h]` |
| **messnamed** | Max/MSP global messaging functionality |

### Reference Links

- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [Max JavaScript API](https://docs.cycling74.com/max8/vignettes/jsmaxapi)
- [Socket.IO Documentation](https://socket.io/docs/v4/)

---

## Copyright and License

**Original Authors**: Haokun Tian, Shuoyang Zheng

Copyright (c) 2025 Haokun Tian, Shuoyang Zheng

This project is licensed under the MIT License - see LICENSE file for details.

**Multi-Patch Edition Contributors**:
- Hiroshi Yamato ([@dropcontrol](https://github.com/dropcontrol)) - Multi-patch support development, refactoring, and testing using Claude Code
