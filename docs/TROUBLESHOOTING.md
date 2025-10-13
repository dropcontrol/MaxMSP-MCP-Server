# Troubleshooting Guide

## Quick Diagnostics

### System Health Check

Run these commands to verify system status:

```bash
# Check MCP connection
claude mcp list | grep MaxMSPMCP
# Expected: ✓ Connected

# Check Python environment
cd MaxMSP-MCP-Server-multipatch
python --version
# Expected: Python 3.8+

# Check Node.js
cd MaxMSP_Agent
npm list socket.io
# Expected: socket.io@^4.8.1

# Check port availability
lsof -i :5002
# Expected: node.script process OR empty if not started
```

### Max/MSP Console Check

Open Max Console (Window → Max Console) and verify:
- ✅ No red error messages
- ✅ Socket.IO connection messages present
- ✅ Patch registration messages appear when patches open

## Common Issues

### Issue 1: MCP Tools Timeout (2 seconds)

**Symptoms**:
```python
list_registered_patches()
# Error: Timeout after 2 seconds
```

**Causes**:
1. Python MCP Server not connected to Socket.IO
2. Socket.IO server not running in Max
3. Patch not registered

**Solutions**:

**Solution A: Restart Claude Code**
```bash
# Close Claude Code tab
# Reopen Claude Code
# Wait for MCP connection
```

**Solution B: Restart Socket.IO Server in Max**
1. Open `demo.maxpat`
2. Navigate to 2nd tab (showontab 2)
3. Click `script start`
4. Verify Max Console shows: `"Server listening on port 5002"`

**Solution C: Check Patch Registration**
```python
# Try list_registered_patches() again
patches = list_registered_patches()
print(patches)  # Should return list, even if empty
```

**Solution D: Check Python Process**
```bash
# Find Python MCP processes
ps aux | grep server.py

# If multiple processes, kill old ones
pkill -f "server.py"

# Restart Claude Code
```

---

### Issue 2: Patch Not Registered

**Symptoms**:
```python
list_registered_patches()
# Returns: []
# or
add_max_object(patch_id="test1", ...)
# Max Console: "mcp-router: Patch not registered: test1"
```

**Causes**:
1. `[js mcp_client.js <patch_id>]` not in patch
2. Loadbang not executed
3. Registration message not sent
4. JavaScript error in mcp_client.js

**Solutions**:

**Solution A: Verify Client Object Exists**
1. Open patch in Max/MSP
2. Check for `[js mcp_client.js <patch_id>]` object
3. If missing, add it: Object → New Object → type `js mcp_client.js test1`

**Solution B: Trigger Registration**
1. Click loadbang object (if present)
2. Or close and reopen patch
3. Check Max Console for: `"mcp-router: ✓ Registered patch_id=test1"`

**Solution C: Check JavaScript Errors**
1. Open Max Console
2. Look for red error messages
3. Common errors:
   - `js: no such file: mcp_client.js` → File path issue
   - `js: syntax error` → Code error in mcp_client.js

**Solution D: Manual Registration Test**
In Max Console, type:
```
messnamed mcp_register test1
```
Then check `list_registered_patches()` again.

---

### Issue 3: Socket.IO Server Won't Start

**Symptoms**:
```
Max Console:
Error: listen EADDRINUSE: address already in use :::5002
```

**Cause**: Port 5002 is already in use

**Solutions**:

**Solution A: Find and Kill Process**
```bash
# Find process using port 5002
lsof -i :5002

# Output example:
# COMMAND   PID    USER   FD   TYPE  DEVICE  SIZE/OFF NODE NAME
# node    12345  yamato   23u  IPv6  0x...         0t0  TCP *:5002 (LISTEN)

# Kill the process
kill -9 12345

# Or kill all node processes (careful!)
pkill -9 node
```

**Solution B: Change Port** (Advanced)
1. Edit `max_mcp_node.js`:
   ```javascript
   const PORT = process.env.SOCKETIO_SERVER_PORT || 5003;  // Changed from 5002
   ```
2. Set environment variable:
   ```bash
   export SOCKETIO_SERVER_PORT=5003
   ```
3. Restart Claude Code

---

### Issue 4: Objects Appear in Wrong Patch

**Symptoms**:
```python
add_max_object(patch_id="synth", ...)
# Object appears in demo.maxpat instead of synth.maxpat
```

**Cause**: Using old single-patch `server.py` instead of multi-patch version

**Solutions**:

**Solution A: Verify Correct server.py**
```bash
cd MaxMSP-MCP-Server-multipatch
ls -lh server.py
# Should be ~16KB (multi-patch version)
# If ~14KB, it's the old single-patch version

# Check content
grep "patch_id" server.py | head -n 5
# Should see patch_id parameters in tool functions
```

**Solution B: Restore Correct Version**
```bash
# If server_single_patch_backup.py exists
cp server_single_patch_backup.py server.py.broken
git checkout server.py
# or
# Copy from patch_id version if you have it
```

**Solution C: Restart Claude Code**
After fixing server.py, restart Claude Code to reload the corrected version.

---

### Issue 5: varname Conflict

**Symptoms**:
```python
add_max_object(patch_id="synth", position=[100,100], obj_type="cycle~", varname="osc1", args=[440])
# Error: Object with varname 'osc1' already exists
```

**Cause**: Another object in the patch already uses varname "osc1"

**Solutions**:

**Solution A: Use Different varname**
```python
add_max_object(patch_id="synth", position=[100,100], obj_type="cycle~", varname="osc2", args=[440])
```

**Solution B: Remove Existing Object First**
```python
remove_max_object(patch_id="synth", varname="osc1")
add_max_object(patch_id="synth", position=[100,100], obj_type="cycle~", varname="osc1", args=[440])
```

**Solution C: Check Existing varnames**
```python
patch_data = get_objects_in_patch(patch_id="synth")
varnames = [obj["varname"] for obj in patch_data["objects"]]
print("Existing varnames:", varnames)
```

---

### Issue 6: Connection Failed

**Symptoms**:
```python
connect_max_objects(patch_id="synth", src_varname="osc1", outlet_idx=0, dst_varname="gain1", inlet_idx=0)
# Error: Object not found or connection failed
```

**Causes**:
1. Source or destination object doesn't exist
2. Invalid outlet/inlet index
3. Objects not in same patch

**Solutions**:

**Solution A: Verify Objects Exist**
```python
patch_data = get_objects_in_patch(patch_id="synth")
varnames = [obj["varname"] for obj in patch_data["objects"]]

if "osc1" not in varnames:
    print("Error: osc1 not found")
if "gain1" not in varnames:
    print("Error: gain1 not found")
```

**Solution B: Check Outlet/Inlet Counts**
```python
# Get object documentation
doc = get_object_doc("cycle~")
print(f"Outlets: {doc.get('outlets', 'Unknown')}")

doc = get_object_doc("gain~")
print(f"Inlets: {doc.get('inlets', 'Unknown')}")
```

**Solution C: Use Correct Indices**
Remember: indices are 0-based
- First outlet/inlet: 0
- Second outlet/inlet: 1
- etc.

---

### Issue 7: JavaScript Errors in Max Console

**Symptoms**:
```
Max Console:
js: mcp-client.js: error: ReferenceError: undefined variable
js: mcp-router.js: syntax error
```

**Causes**:
1. File corruption
2. Incorrect file path
3. Syntax error in custom modifications

**Solutions**:

**Solution A: Verify File Integrity**
```bash
cd MaxMSP_Agent

# Check files exist
ls -l mcp_client.js mcp-router.js max_mcp.js

# Check for syntax errors
node --check mcp_client.js
node --check mcp-router.js
node --check max_mcp.js
```

**Solution B: Restore from Backup**
```bash
# If using git
git checkout mcp_client.js mcp-router.js max_mcp.js

# Or copy from original repository
```

**Solution C: Check autowatch**
Max JavaScript with `autowatch = 1` reloads automatically. If you edited a file while Max is open:
1. Save the file
2. Max should reload automatically
3. Check Console for reload message

---

### Issue 8: Python Import Errors

**Symptoms**:
```bash
python server.py
# Error: ModuleNotFoundError: No module named 'mcp'
```

**Cause**: Python dependencies not installed or wrong Python environment

**Solutions**:

**Solution A: Verify Virtual Environment**
```bash
cd MaxMSP-MCP-Server-multipatch

# Check if .venv exists
ls -la .venv

# Activate and test
source .venv/bin/activate  # macOS/Linux
python -c "import mcp, socketio; print('OK')"
```

**Solution B: Reinstall Dependencies**
```bash
# Using uv
uv pip install --force-reinstall -r requirements.txt

# Using pip
pip install --force-reinstall -r requirements.txt
```

**Solution C: Check Python Version**
```bash
python --version
# Must be 3.8 or higher

# If wrong version, use specific Python
python3.11 -m venv .venv
```

---

### Issue 9: Max Can't Find JavaScript Files

**Symptoms**:
```
Max Console:
js: no such file: mcp_client.js
```

**Causes**:
1. Incorrect file path in `[js]` object
2. File doesn't exist
3. Max search path issue

**Solutions**:

**Solution A: Use Absolute Path**
```max
[js /Users/yamato/Src/proj_max_mcp/MaxMSP-MCP-Server-multipatch/MaxMSP_Agent/mcp_client.js test1]
```

**Solution B: Place File in Max Search Path**
Max automatically searches:
- Same directory as patch
- `~/Documents/Max 9/Library/`
- Package directories

Copy files:
```bash
cp MaxMSP_Agent/*.js ~/Documents/Max\\ 9/Library/
```

**Solution C: Add to Search Path**
In Max:
1. Options → File Preferences
2. Add path to `MaxMSP_Agent/` directory
3. Restart Max

---

### Issue 10: Demo Patch Errors

**Symptoms**:
Opening `demo.maxpat` shows many errors

**Cause**: File paths changed or Max version incompatibility

**Solutions**:

**Solution A: Update File Paths**
1. Edit `demo.maxpat` in text editor
2. Find all absolute paths (e.g., `/Users/yamato/...`)
3. Replace with current paths
4. Save and reopen in Max

**Solution B: Use Relative Paths**
Change:
```json
"filename": "/absolute/path/to/mcp-router.js"
```
To:
```json
"filename": "mcp-router.js"
```

**Solution C: Rebuild Patch**
If too many errors:
1. Create new patch
2. Add `[node.script max_mcp_node.js]`
3. Add `[js max_mcp.js]`
4. Add `[js mcp-router.js]`
5. Connect properly (see [Architecture](ARCHITECTURE.md))

---

## Advanced Troubleshooting

### Enable Debug Logging

**Python Side** (`server.py`):
Add at top of file:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Max Side** (`max_mcp.js`, etc.):
Already using `post()` for logging. Check Max Console.

### Network Issues

**Check Socket.IO Connection**:
```bash
# Test port is listening
nc -zv 127.0.0.1 5002

# If open:
Connection to 127.0.0.1 port 5002 [tcp/*] succeeded!
```

**Monitor Socket.IO Events**:
Add to `max_mcp_node.js`:
```javascript
socket.on("connect", () => {
    Max.post("Socket.IO: Connected\n");
});

socket.on("disconnect", (reason) => {
    Max.post("Socket.IO: Disconnected - " + reason + "\n");
});
```

### Performance Issues

**Slow Operations**:
1. Check Max CPU usage (Max Window → Activity Monitor)
2. Reduce concurrent operations
3. Check JSON message sizes
4. Verify localhost connection (not remote)

**Max Freezing**:
1. JavaScript execution is synchronous
2. Avoid large loops in JS code
3. Break up batch operations
4. Use `task.schedule()` for deferred execution (advanced)

### Data Corruption

**Patch File Corrupted**:
```bash
# Backup first
cp your_patch.maxpat your_patch.maxpat.backup

# Try to repair (remove binary data)
sed -i '' '/^$/d' your_patch.maxpat
```

**docs.json Corrupted**:
```bash
# Re-download from repository
curl -O https://raw.githubusercontent.com/tiianhk/MaxMSP-MCP-Server/main/docs.json
```

## Getting Help

### Information to Provide

When reporting issues, include:

1. **System Info**:
   ```bash
   uname -a
   python --version
   node --version
   ```

2. **Max Info**:
   - Max/MSP version (Help → About Max)
   - Max Console output (copy full log)

3. **MCP Status**:
   ```bash
   claude mcp list
   ```

4. **Error Messages**:
   - Full error text
   - Stack traces
   - Max Console logs

5. **Reproduction Steps**:
   - Exact commands run
   - Expected vs actual behavior

### Related Documents

- [Setup Guide](SETUP.md) - Installation and configuration
- [Usage Guide](USAGE.md) - How to use the system
- [Architecture](ARCHITECTURE.md) - System design
- [E2E Test Guide](E2E_TEST_GUIDE.md) - Testing procedures

---

**Still Having Issues?**

Check the GitHub repository for:
- Known issues
- Recent fixes
- Community discussions

Or create a new issue with detailed information above.
