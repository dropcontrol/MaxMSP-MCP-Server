# MaxMSP-MCP Server - Multi-Patch Edition

> Enable Large Language Models to directly understand, generate, and manipulate Max/MSP patches using the Model Context Protocol (MCP).

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Max/MSP](https://img.shields.io/badge/Max%2FMSP-9%2B-orange.svg)](https://cycling74.com/products/max)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-61%20passing-brightgreen.svg)](MaxMSP_Agent/test/)

## Features

- 🎹 **Patch Understanding**: LLMs analyze Max/MSP patch structures and objects
- 🔧 **Patch Generation**: LLMs create and connect Max/MSP objects
- ⚙️ **Patch Manipulation**: Modify attributes, delete objects, manage connections
- 📚 **Documentation Access**: Access official Max/MSP object documentation
- 🎛️ **Multi-Patch Support**: Simultaneously manage and operate multiple patches (NEW!)

## Demo

### Understand: LLM Explaining a Max Patch

![img](./assets/understand.gif)

[Video link](https://www.youtube.com/watch?v=YKXqS66zrec). Acknowledgement: the patch being explained is downloaded from [here](https://github.com/jeffThompson/MaxMSP_TeachingSketches/blob/master/02_MSP/07%20Ring%20Modulation.maxpat). Text comments in the original file are deleted.

### Generate: LLM Making an FM Synth

![img](./assets/generate.gif)

Check out the [full video](https://www.youtube.com/watch?v=Ns89YuE5-to) where you can listen to the synthesized sounds.

## Documentation

- **[Specification (English)](docs/SPECIFICATION.md)** - Complete technical specification
- **[仕様書（日本語）](docs/SPECIFICATION_ja.md)** - 完全な技術仕様書
- **[E2E Test Guide](MaxMSP_Agent/test/E2E_TEST_GUIDE.md)** - End-to-end testing guide
- **[Original README](README_ORIGINAL.md)** - Original project README

## Quick Start

### Prerequisites

- **Max/MSP**: Version 9 or later (JavaScript V8 engine required)
- **Python**: 3.8 or later
- **uv package manager**: [Installation guide](https://github.com/astral-sh/uv)
- **Node.js**: npm execution environment

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/dropcontrol/MaxMSP-MCP-Server.git
cd MaxMSP-MCP-Server
```

#### 2. Setup Python Environment

```bash
# Install uv (if not installed)
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows:
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Create virtual environment and install dependencies
uv venv
uv pip install -r requirements.txt
```

#### 3. Setup Max/MSP Agent

```bash
cd MaxMSP_Agent
npm install
```

#### 4. Connect to MCP Client

**Recommended: Claude Code (CLI) - Tested ✅**

```bash
# Default installation for Claude Code
python install.py

# Or explicitly specify claude-code
python install.py --client claude-code
```

After installation:
1. Restart Claude Code session if needed
2. Verify: `claude mcp list`
3. Look for `MaxMSPMCP: ✓ Connected`

**Other Clients (Untested ⚠️)**

```bash
# Claude Desktop (not tested with this multi-patch edition)
python install.py --client claude-desktop

# Cursor (not tested with this multi-patch edition)
python install.py --client cursor
```

For other MCP clients, see the [list](https://modelcontextprotocol.io/clients) and manually add configuration to use `MaxMSPMCP` as the server name.

### Usage

#### 1. Start Max/MSP Agent

1. Open `MaxMSP_Agent/demo.maxpat` in Max/MSP
2. Click the first tab
3. Click `script npm version` to verify npm installation
4. Click `script npm install` to install dependencies
5. Switch to the second tab
6. Click `script start` to initiate communication with Python

#### 2. Use with LLM

Once connected, you can interact with the LLM interface to:

- Explain existing Max/MSP patches
- Generate new patches from descriptions
- Modify and debug existing patches
- Query Max/MSP object documentation

## Architecture

```
LLM (MCP Client)
    ↕ MCP Protocol
Python MCP Server (server.py)
    ↕ Socket.IO (Port 5002)
Node.js Socket.IO Server (max_mcp_node.js)
    ↕ messnamed (Max send/receive)
Message Router (mcp-router.js)
    ↕ patch_id-based routing
MCP Clients (mcp_client.js) × Multiple Patches
    ↕ Max JavaScript API
Max/MSP Patches
```

For detailed architecture, see [Specification](docs/SPECIFICATION.md).

## Multi-Patch Support

This edition supports **simultaneous management of multiple Max/MSP patches**:

- Each patch has a unique `patch_id`
- Messages are routed based on `patch_id`
- Multiple patches can be controlled independently
- Global commands available (e.g., `list_registered_patches()`)

## API Overview

### Patch Management

- `list_registered_patches()` - Get list of active patches

### Object Manipulation

- `add_max_object(patch_id, position, obj_type, varname, args)` - Add object
- `remove_max_object(patch_id, varname)` - Remove object
- `connect_max_objects(patch_id, src, outlet, dst, inlet)` - Connect objects
- `disconnect_max_objects(patch_id, src, outlet, dst, inlet)` - Disconnect objects
- `set_object_attribute(patch_id, varname, attr_name, attr_value)` - Set attribute

### Patch Information

- `get_objects_in_patch(patch_id)` - Get all objects and connections
- `get_avoid_rect_position(patch_id)` - Get area for object placement

### Documentation

- `list_all_objects()` - List all Max/MSP objects
- `get_object_doc(object_name)` - Get official documentation

For complete API documentation, see [Specification](docs/SPECIFICATION.md#api-specification).

## Testing

### Unit Tests

61 unit tests ensure code quality:

```bash
cd MaxMSP_Agent
npm test                 # Run tests
npm run test:coverage    # Generate coverage report
npm run test:ui          # View tests in browser
```

### E2E Tests

Collaborative testing between user and Claude:

1. Follow [E2E Test Guide](MaxMSP_Agent/test/E2E_TEST_GUIDE.md)
2. Execute 9 test scenarios
3. Verify results in Max/MSP

## Troubleshooting

### Socket.IO Connection Error

- Verify `script start` was executed in demo.maxpat
- Check `SOCKETIO_SERVER_PORT` matches (default: 5002)
- Verify firewall settings

### Object Not Found

- Check `varname` is correctly set
- Use `get_objects_in_patch()` to verify patch state
- Avoid `maxmcpid-*` prefix (reserved for internal use)

### V8 Engine Error

- Ensure Max 9 or later is installed
- For Max 8 or earlier, see comments in `max_mcp.js` for alternative implementation

For more troubleshooting, see [Specification](docs/SPECIFICATION.md#error-handling).

## Development

### File Structure

```
MaxMSP-MCP-Server-multipatch/
├── server.py                  # Python MCP server
├── install.py                 # MCP client configuration script
├── requirements.txt           # Python dependencies
├── docs.json                  # Max/MSP object documentation (6MB)
├── docs/
│   ├── SPECIFICATION.md       # Technical specification (English)
│   └── SPECIFICATION_ja.md    # Technical specification (Japanese)
└── MaxMSP_Agent/
    ├── demo.maxpat            # Demo patch
    ├── mcp_client.js          # Client agent (per patch)
    ├── mcp-router.js          # Message router
    ├── max_mcp_node.js        # Socket.IO server
    ├── test/                  # Unit tests
    │   ├── mcp_client.test.js
    │   ├── mcp-router.test.js
    │   ├── max_mcp_node.test.js
    │   └── E2E_TEST_GUIDE.md
    ├── vitest.config.js       # Test configuration
    └── package.json           # Node.js dependencies
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOCKETIO_SERVER_URL` | `http://127.0.0.1` | Socket.IO server URL |
| `SOCKETIO_SERVER_PORT` | `5002` | Socket.IO server port |
| `NAMESPACE` | `/mcp` | Socket.IO namespace |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Original Authors**: Haokun Tian, Shuoyang Zheng
Copyright (c) 2025

**Multi-Patch Edition Contributors**:
- Hiroshi Yamato ([@dropcontrol](https://github.com/dropcontrol)) - Multi-patch support development using Claude Code

## Disclaimer

This is a third-party implementation and not made by Cycling '74.

## Acknowledgements

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Max/MSP](https://cycling74.com/products/max) by Cycling '74
- Demo patch from [Max/MSP Teaching Sketches](https://github.com/jeffThompson/MaxMSP_TeachingSketches) by Jeff Thompson
- Original MaxMSP-MCP Server by Haokun Tian and Shuoyang Zheng

## Links

- [Documentation](docs/SPECIFICATION.md)
- [Original README](README_ORIGINAL.md)
- [Issue Tracker](https://github.com/dropcontrol/MaxMSP-MCP-Server/issues)
- [MCP Documentation](https://modelcontextprotocol.io/introduction)
- [Max JavaScript API](https://docs.cycling74.com/max8/vignettes/jsmaxapi)

---

**Made with ❤️ for the Max/MSP and AI communities**
