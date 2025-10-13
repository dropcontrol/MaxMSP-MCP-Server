# Setup Guide

## Overview

This guide walks you through setting up the MaxMSP-MCP multi-patch system on your machine.

## Prerequisites

### System Requirements

- **macOS**: Darwin 25.0.0+ (tested on macOS)
- **Windows/Linux**: Should work but untested
- **Max/MSP**: Version 9+ required (V8 JavaScript engine)
- **Python**: 3.8 or higher
- **Node.js**: v16+ recommended

### Tools Required

- **uv** (recommended) or **pip** - Python package manager
- **npm** - Node.js package manager
- **Claude Code** - MCP client

## Installation Steps

### Step 1: Python Environment Setup

Navigate to the multipatch directory:

```bash
cd /path/to/MaxMSP-MCP-Server-multipatch
```

**Option A: Using uv (recommended)**

```bash
# Create virtual environment
uv venv

# Install dependencies
uv pip install -r requirements.txt
```

**Option B: Using standard pip**

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Node.js Dependencies

```bash
cd MaxMSP_Agent
npm install
```

Expected packages:
- socket.io: ^4.8.1

### Step 3: Claude Code MCP Registration

**Method A: Using install.py (Recommended)**

```bash
# From project directory
cd /path/to/MaxMSP-MCP-Server-multipatch
python install.py
```

Expected output:
```
✓ Successfully configured MaxMSPMCP for claude-code
  Config file: /Users/username/.claude.json

📝 Next steps:
  1. Restart Claude Code session if needed
  2. Verify connection with: claude mcp list
  3. Start Max/MSP Agent (demo.maxpat → script start)
  4. Begin using MCP tools in Claude Code!
```

**Note**: For Claude Desktop or Cursor, specify `--client` option (untested):
```bash
python install.py --client claude-desktop  # untested
python install.py --client cursor          # untested
```

**Method B: Manual Registration**

```bash
# From project root directory
claude mcp add MaxMSPMCP \
  $(pwd)/.venv/bin/python \
  $(pwd)/server.py
```

**Verify registration**:

```bash
claude mcp list
```

Expected output:
```
MaxMSPMCP: /path/to/.venv/bin/python /path/to/server.py - ✓ Connected
```

### Step 4: Max/MSP Configuration

**No additional configuration needed**. Max will automatically find:
- JavaScript files in `MaxMSP_Agent/` directory
- `docs.json` for object documentation (6MB)

## Directory Structure After Setup

```
MaxMSP-MCP-Server-multipatch/
├── .venv/                    # Python virtual environment ✅
│   ├── bin/python            # Python executable
│   └── lib/...               # Installed packages
├── MaxMSP_Agent/
│   ├── node_modules/         # Node.js dependencies ✅
│   ├── demo.maxpat           # Central hub patch
│   ├── max_mcp_node.js       # Socket.IO server
│   ├── max_mcp.js            # Max bridge
│   ├── mcp-router.js         # Router
│   ├── mcp_client.js         # Client
│   └── test1.maxpat          # Test patch
├── server.py                 # Python MCP server
├── requirements.txt
└── docs.json                 # Max object documentation
```

## Verification

### 1. Python Environment

```bash
cd MaxMSP-MCP-Server-multipatch
source .venv/bin/activate  # if using standard venv

python --version
# Should be Python 3.8+

python -c "import mcp, socketio; print('Dependencies OK')"
# Should print: Dependencies OK
```

### 2. Node.js Environment

```bash
cd MaxMSP_Agent
npm list socket.io
# Should show socket.io@^4.8.1
```

### 3. MCP Registration

```bash
claude mcp list | grep MaxMSPMCP
# Should show: MaxMSPMCP: ... - ✓ Connected
```

### 4. Max/MSP

Open Max/MSP and:
1. Open `MaxMSP_Agent/demo.maxpat`
2. Check for errors in Max Console
3. Should see no red errors

## First Run

### 1. Start Socket.IO Server in Max

1. Open `demo.maxpat` in Max/MSP
2. Navigate to 2nd tab (showontab 2)
3. Click `script start` button
4. Verify Max Console shows:
   ```
   port-number: "Server listening on port 5002"
   node.script: Socket.IO server started
   ```

### 2. Open Test Patch

1. Open `test1.maxpat` in Max/MSP
2. Verify it contains `[js mcp_client.js test1]`
3. Check Max Console for:
   ```
   js: mcp-client: Initializing with patch_id=test1
   js: mcp-router: ✓ Registered patch_id=test1
   ```

### 3. Test from Claude Code

Launch Claude Code and try:

```python
# List registered patches
list_registered_patches()
# Expected: ["test1"]

# Add a simple object
add_max_object(
    patch_id="test1",
    position=[200, 300],
    obj_type="button",
    varname="test_button",
    args=[]
)
```

If successful, you should see a button appear in test1.maxpat at position [200, 300].

## Troubleshooting Setup Issues

### Issue: Python Dependencies Failed

**Error**: `Could not find a version that satisfies...`

**Solution**:
1. Update pip: `pip install --upgrade pip`
2. Try uv instead: `brew install uv` (macOS)
3. Check Python version: `python --version` (need 3.8+)

### Issue: npm install Failed

**Error**: `npm ERR! code ENOENT`

**Solution**:
1. Check Node.js is installed: `node --version`
2. Install Node.js: https://nodejs.org/
3. Try again: `npm install`

### Issue: MCP Server Not Connecting

**Error**: `MaxMSPMCP: ... - ✗ Disconnected`

**Solution**:
1. Check Python path is correct: `which python` or `.venv/bin/python`
2. Check server.py exists: `ls server.py`
3. Test server manually: `python server.py`
4. Restart Claude Code

### Issue: Socket.IO Server Won't Start

**Error**: `Error: listen EADDRINUSE: address already in use :::5002`

**Solution**:
Port 5002 is already in use.

```bash
# Find process using port 5002
lsof -i :5002

# Kill the process
kill -9 <PID>

# Try again in Max
```

### Issue: test1.maxpat Registration Failed

**Symptoms**: `list_registered_patches()` returns `[]`

**Solution**:
1. Check `[js mcp_client.js test1]` exists in patch
2. Click loadbang or registration button
3. Check Max Console for errors
4. Restart Socket.IO server (`script start`)

## Environment Variables (Optional)

If you need to customize the Socket.IO configuration:

**macOS/Linux** (add to `~/.zshrc` or `~/.bashrc`):
```bash
export SOCKETIO_SERVER_URL=http://127.0.0.1
export SOCKETIO_SERVER_PORT=5002
export NAMESPACE=/mcp
```

**Windows** (System Properties → Environment Variables):
```
SOCKETIO_SERVER_URL=http://127.0.0.1
SOCKETIO_SERVER_PORT=5002
NAMESPACE=/mcp
```

## Next Steps

After successful setup:

1. **Read Architecture**: Understand how the system works
   - [Architecture Guide](ARCHITECTURE.md)

2. **Learn Usage**: Learn how to use MCP tools
   - [Usage Guide](USAGE.md)

3. **Run E2E Tests**: Verify everything works
   - [E2E Test Guide](E2E_TEST_GUIDE.md)

4. **Create Your Own Patch**: Start building
   - Add `[js mcp_client.js <your_patch_id>]` to your patch
   - Test with Claude Code

## Updating

### Update Python Dependencies

```bash
cd MaxMSP-MCP-Server-multipatch
uv pip install --upgrade -r requirements.txt
# or
pip install --upgrade -r requirements.txt
```

### Update Node.js Dependencies

```bash
cd MaxMSP_Agent
npm update
```

### Update MCP Registration

If the Python path changes:

```bash
# Remove old registration
claude mcp remove MaxMSPMCP

# Add new registration
claude mcp add MaxMSPMCP \
  /new/path/.venv/bin/python \
  /new/path/server.py
```

## Uninstallation

### Remove MCP Registration

```bash
claude mcp remove MaxMSPMCP
```

### Remove Python Environment

```bash
cd MaxMSP-MCP-Server-multipatch
rm -rf .venv
```

### Remove Node.js Dependencies

```bash
cd MaxMSP_Agent
rm -rf node_modules package-lock.json
```

### Remove Directory

```bash
cd ..
rm -rf MaxMSP-MCP-Server-multipatch
```

## Support

- **Setup Issues**: Check [Troubleshooting](TROUBLESHOOTING.md)
- **Usage Questions**: See [Usage Guide](USAGE.md)
- **Architecture**: Understand [Architecture](ARCHITECTURE.md)

---

**Setup Complete!** 🎉

You're now ready to control Max/MSP patches with Claude Code.
