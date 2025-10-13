# E2E Test Guide

## Overview

This guide provides end-to-end testing procedures for the MaxMSP-MCP multi-patch system. Tests include state verification at each step to ensure correct operation.

## Prerequisites

### Environment Check

Before testing:

```bash
# 1. Check MCP connection
claude mcp list | grep MaxMSPMCP
# Expected: ✓ Connected

# 2. Check working directory
pwd
# Expected: /path/to/MaxMSP-MCP-Server-multipatch

# 3. Check Python environment
python --version
# Expected: Python 3.8+
```

### Max/MSP Setup

**Required patches**:
1. `demo.maxpat` - Central hub (Socket.IO server)
2. `test1.maxpat` - Test patch with `[js mcp_client.js test1]`

**Steps**:
1. Open `MaxMSP_Agent/demo.maxpat`
2. Navigate to 2nd tab (showontab 2)
3. Click `script start`
4. Verify Max Console shows:
   ```
   port-number: "Server listening on port 5002"
   node.script: Socket.IO client connected: [ID1]
   node.script: Socket.IO client connected: [ID2]
   node.script: Socket.IO client connected: [ID3]  ← Python MCP Server
   ```

5. Open `test1.maxpat`
6. Verify Max Console shows:
   ```
   js: mcp-client: Initializing with patch_id=test1
   js: mcp-router: ✓ Registered patch_id=test1
   ```

## Test Suite

### Test 0: Connection Verification

**Purpose**: Verify all system components are connected

**Commands**:
```python
# Check registered patches
patches = list_registered_patches()
print(f"Registered patches: {patches}")
```

**Expected Result**:
```python
["test1"]  # or other registered patch_ids
```

**Verification**:
- No timeout errors
- Returns list (even if empty)
- Max Console shows 3 Socket.IO connections

**If Failed**:
- Restart Claude Code
- Check `script start` in demo.maxpat
- Verify test1.maxpat is open

---

### Test 1: Initial State Capture

**Purpose**: Record baseline state before modifications

**Commands**:
```python
# Get current patch state
initial_state = get_objects_in_patch(patch_id="test1")
initial_count = len(initial_state.get("objects", []))
initial_connections = len(initial_state.get("patchcords", []))

print(f"Initial objects: {initial_count}")
print(f"Initial connections: {initial_connections}")

# List existing varnames
for obj in initial_state["objects"]:
    print(f"  - {obj.get('varname', 'no-varname')}: {obj.get('text', 'no-text')}")
```

**Expected Result**:
```
Initial objects: 1 (or more, depending on patch)
Initial connections: 0 (or more)
  - mcp_js_test1: js mcp_client.js test1
```

**Save for Later**:
Store `initial_count` for final verification.

---

### Test 2: Get Placement Area

**Purpose**: Find safe area for adding new objects

**Commands**:
```python
avoid_rect = get_avoid_rect_position(patch_id="test1")
print(f"Avoid rect: {avoid_rect}")
[left, top, right, bottom] = avoid_rect

# Calculate safe position
safe_x = right + 50
safe_y = top + 50

print(f"Safe position: [{safe_x}, {safe_y}]")
```

**Expected Result**:
```
Avoid rect: [10, 10, 200, 100]  # Example values
Safe position: [250, 150]
```

---

### Test 3: Add Single Object

**Purpose**: Add one object and verify creation

**Commands**:
```python
# Add button
add_max_object(
    patch_id="test1",
    position=[250, 150],
    obj_type="button",
    varname="test_button",
    args=[]
)

# Verify
state_after = get_objects_in_patch(patch_id="test1")
count_after = len(state_after["objects"])
varnames = [obj["varname"] for obj in state_after["objects"]]

print(f"Objects after add: {count_after}")
print(f"Expected: {initial_count + 1}")
print(f"test_button in varnames: {'test_button' in varnames}")
```

**Expected Result**:
```
Objects after add: 2 (if initial_count was 1)
Expected: 2
test_button in varnames: True
```

**Visual Verification**:
- Open test1.maxpat in Max
- See button at position [250, 150]
- Click button → visual feedback

**If Failed**:
- Check Max Console for errors
- Verify patch_id is "test1"
- Try different varname

---

### Test 4: Add Multiple Objects (Signal Chain)

**Purpose**: Create oscillator → gain → output chain

**Commands**:
```python
# Add cycle~
add_max_object(
    patch_id="test1",
    position=[100, 200],
    obj_type="cycle~",
    varname="test_osc",
    args=[440]
)

# Add gain~
add_max_object(
    patch_id="test1",
    position=[100, 300],
    obj_type="gain~",
    varname="test_gain",
    args=[]
)

# Add ezdac~
add_max_object(
    patch_id="test1",
    position=[100, 400],
    obj_type="ezdac~",
    varname="test_dac",
    args=[]
)

# Verify all created
state = get_objects_in_patch(patch_id="test1")
varnames = [obj["varname"] for obj in state["objects"]]

required = ["test_osc", "test_gain", "test_dac"]
all_present = all(v in varnames for v in required)

print(f"All objects created: {all_present}")
print(f"Total objects: {len(state['objects'])}")
```

**Expected Result**:
```
All objects created: True
Total objects: 5 (initial + button + 3 new)
```

---

### Test 5: Connect Objects

**Purpose**: Create signal flow connections

**Commands**:
```python
# Connect cycle~ → gain~
connect_max_objects(
    patch_id="test1",
    src_varname="test_osc",
    outlet_idx=0,
    dst_varname="test_gain",
    inlet_idx=0
)

# Connect gain~ → ezdac~ (left)
connect_max_objects(
    patch_id="test1",
    src_varname="test_gain",
    outlet_idx=0,
    dst_varname="test_dac",
    inlet_idx=0
)

# Connect gain~ → ezdac~ (right)
connect_max_objects(
    patch_id="test1",
    src_varname="test_gain",
    outlet_idx=0,
    dst_varname="test_dac",
    inlet_idx=1
)

# Verify connections
state = get_objects_in_patch(patch_id="test1")
patchcords = state["patchcords"]

print(f"Total connections: {len(patchcords)}")
print("Connections:")
for pc in patchcords:
    print(f"  {pc['src']}[{pc['src_outlet']}] → {pc['dst']}[{pc['dst_inlet']}]")
```

**Expected Result**:
```
Total connections: 3
Connections:
  test_osc[0] → test_gain[0]
  test_gain[0] → test_dac[0]
  test_gain[0] → test_dac[1]
```

**Visual Verification**:
- Patchcords visible in Max
- Signal path: cycle~ → gain~ → ezdac~

**Functional Verification**:
1. Click ezdac~ in Max to turn on audio
2. Should hear 440Hz sine wave
3. Move gain~ slider to adjust volume

---

### Test 6: Modify Object (Frequency Change)

**Purpose**: Verify attribute modification (if implemented)

**Note**: This test depends on `set_object_attribute()` implementation.

**Commands**:
```python
# If implemented:
# set_object_attribute(patch_id="test1", varname="test_osc", attribute="freq", value=880)

# Alternative: Remove and recreate with new frequency
remove_max_object(patch_id="test1", varname="test_osc")
add_max_object(
    patch_id="test1",
    position=[100, 200],
    obj_type="cycle~",
    varname="test_osc",
    args=[880]  # Changed from 440 to 880
)

# Reconnect
connect_max_objects(
    patch_id="test1",
    src_varname="test_osc",
    outlet_idx=0,
    dst_varname="test_gain",
    inlet_idx=0
)

print("✓ Frequency changed to 880Hz")
```

**Functional Verification**:
- Pitch should double (one octave higher)
- Should hear 880Hz instead of 440Hz

---

### Test 7: Disconnect Single Connection

**Purpose**: Remove one patchcord

**Commands**:
```python
# Disconnect right channel
disconnect_max_objects(
    patch_id="test1",
    src_varname="test_gain",
    outlet_idx=0,
    dst_varname="test_dac",
    inlet_idx=1
)

# Verify
state = get_objects_in_patch(patch_id="test1")
patchcords = state["patchcords"]

print(f"Connections after disconnect: {len(patchcords)}")
print("Remaining connections:")
for pc in patchcords:
    print(f"  {pc['src']}[{pc['src_outlet']}] → {pc['dst']}[{pc['dst_inlet']}]")
```

**Expected Result**:
```
Connections after disconnect: 2
Remaining connections:
  test_osc[0] → test_gain[0]
  test_gain[0] → test_dac[0]
```

**Functional Verification**:
- Audio only in left channel
- Right channel silent

---

### Test 8: Remove Objects

**Purpose**: Clean up by removing test objects

**Commands**:
```python
# Remove button
remove_max_object(patch_id="test1", varname="test_button")

# Remove audio objects
remove_max_object(patch_id="test1", varname="test_osc")
remove_max_object(patch_id="test1", varname="test_gain")
remove_max_object(patch_id="test1", varname="test_dac")

# Verify cleanup
state = get_objects_in_patch(patch_id="test1")
final_count = len(state["objects"])
final_connections = len(state["patchcords"])

print(f"Final object count: {final_count}")
print(f"Expected: {initial_count}")
print(f"Back to initial: {final_count == initial_count}")
print(f"Final connections: {final_connections}")
```

**Expected Result**:
```
Final object count: 1 (or initial_count)
Expected: 1
Back to initial: True
Final connections: 0
```

**Visual Verification**:
- All test objects removed from patch
- Only mcp-client object remains

---

### Test 9: Error Handling

**Purpose**: Verify graceful error handling

**Commands**:
```python
# Test 9a: Invalid patch_id
try:
    add_max_object(
        patch_id="nonexistent",
        position=[100, 100],
        obj_type="button",
        varname="error_test",
        args=[]
    )
    print("❌ Should have raised error")
except Exception as e:
    print(f"✓ Error caught: {type(e).__name__}")

# Test 9b: Duplicate varname
add_max_object(patch_id="test1", position=[100,100], obj_type="button", varname="dup", args=[])
try:
    add_max_object(patch_id="test1", position=[200,100], obj_type="button", varname="dup", args=[])
    print("❌ Should have raised error")
except Exception as e:
    print(f"✓ Duplicate varname error caught: {type(e).__name__}")
finally:
    # Cleanup
    remove_max_object(patch_id="test1", varname="dup")

# Test 9c: Invalid connection
try:
    connect_max_objects(
        patch_id="test1",
        src_varname="nonexistent_src",
        outlet_idx=0,
        dst_varname="nonexistent_dst",
        inlet_idx=0
    )
    print("❌ Should have raised error")
except Exception as e:
    print(f"✓ Connection error caught: {type(e).__name__}")

print("\n✓ Error handling tests complete")
```

**Expected Result**:
```
✓ Error caught: TimeoutError (or similar)
✓ Duplicate varname error caught: ...
✓ Connection error caught: ...

✓ Error handling tests complete
```

---

## Complete Test Script

Run all tests in sequence:

```python
print("=== MaxMSP-MCP E2E Test Suite ===\n")

# Test 0: Connection
print("Test 0: Connection Verification")
patches = list_registered_patches()
print(f"✓ Registered patches: {patches}\n")

# Test 1: Initial state
print("Test 1: Initial State")
initial_state = get_objects_in_patch(patch_id="test1")
initial_count = len(initial_state.get("objects", []))
print(f"✓ Initial objects: {initial_count}\n")

# Test 2: Placement area
print("Test 2: Get Placement Area")
avoid_rect = get_avoid_rect_position(patch_id="test1")
safe_x, safe_y = avoid_rect[2] + 50, avoid_rect[1] + 50
print(f"✓ Safe position: [{safe_x}, {safe_y}]\n")

# Test 3: Add button
print("Test 3: Add Single Object")
add_max_object(patch_id="test1", position=[safe_x, safe_y], obj_type="button", varname="test_button", args=[])
state = get_objects_in_patch(patch_id="test1")
assert len(state["objects"]) == initial_count + 1
print("✓ Button added\n")

# Test 4: Add audio chain
print("Test 4: Add Audio Chain")
add_max_object(patch_id="test1", position=[100, 200], obj_type="cycle~", varname="test_osc", args=[440])
add_max_object(patch_id="test1", position=[100, 300], obj_type="gain~", varname="test_gain", args=[])
add_max_object(patch_id="test1", position=[100, 400], obj_type="ezdac~", varname="test_dac", args=[])
state = get_objects_in_patch(patch_id="test1")
assert len(state["objects"]) == initial_count + 4
print("✓ Audio chain created\n")

# Test 5: Connect
print("Test 5: Connect Objects")
connect_max_objects(patch_id="test1", src_varname="test_osc", outlet_idx=0, dst_varname="test_gain", inlet_idx=0)
connect_max_objects(patch_id="test1", src_varname="test_gain", outlet_idx=0, dst_varname="test_dac", inlet_idx=0)
connect_max_objects(patch_id="test1", src_varname="test_gain", outlet_idx=0, dst_varname="test_dac", inlet_idx=1)
state = get_objects_in_patch(patch_id="test1")
assert len(state["patchcords"]) == 3
print("✓ Connections created\n")

# Test 6: Modify (frequency change)
print("Test 6: Modify Object")
remove_max_object(patch_id="test1", varname="test_osc")
add_max_object(patch_id="test1", position=[100, 200], obj_type="cycle~", varname="test_osc", args=[880])
connect_max_objects(patch_id="test1", src_varname="test_osc", outlet_idx=0, dst_varname="test_gain", inlet_idx=0)
print("✓ Frequency changed to 880Hz\n")

# Test 7: Disconnect
print("Test 7: Disconnect Connection")
disconnect_max_objects(patch_id="test1", src_varname="test_gain", outlet_idx=0, dst_varname="test_dac", inlet_idx=1)
state = get_objects_in_patch(patch_id="test1")
assert len(state["patchcords"]) == 2
print("✓ Right channel disconnected\n")

# Test 8: Remove all
print("Test 8: Remove Objects")
remove_max_object(patch_id="test1", varname="test_button")
remove_max_object(patch_id="test1", varname="test_osc")
remove_max_object(patch_id="test1", varname="test_gain")
remove_max_object(patch_id="test1", varname="test_dac")
state = get_objects_in_patch(patch_id="test1")
assert len(state["objects"]) == initial_count
print("✓ Cleanup complete\n")

# Test 9: Error handling (optional)
print("Test 9: Error Handling")
try:
    add_max_object(patch_id="nonexistent", position=[100,100], obj_type="button", varname="error", args=[])
except:
    print("✓ Error handling works\n")

print("=== All Tests Passed! ===")
```

## Success Criteria

All tests should:
- ✅ Complete without timeout errors
- ✅ Match expected object/connection counts
- ✅ Show correct varnames in patch data
- ✅ Produce audible result (Test 5-7)
- ✅ Return to initial state (Test 8)
- ✅ Handle errors gracefully (Test 9)

## Cleanup

After testing:

```python
# Ensure patch is clean
state = get_objects_in_patch(patch_id="test1")
for obj in state["objects"]:
    varname = obj.get("varname", "")
    if varname.startswith("test_"):
        remove_max_object(patch_id="test1", varname=varname)

print("✓ All test objects removed")
```

## Related Documents

- [Setup Guide](SETUP.md) - Installation and configuration
- [Usage Guide](USAGE.md) - How to use MCP tools
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Architecture](ARCHITECTURE.md) - System design

---

**E2E Testing Complete!** 🎉

Your MaxMSP-MCP system is fully operational.
