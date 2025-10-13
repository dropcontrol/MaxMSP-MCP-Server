# Usage Guide

## Overview

This guide explains how to use the MaxMSP-MCP system to control Max/MSP patches from Claude Code using MCP tools.

## Prerequisites

Before using the system, ensure:
- Setup is complete ([Setup Guide](SETUP.md))
- Socket.IO server is running in Max (`script start` in demo.maxpat)
- Test patch is open with `[js mcp_client.js <patch_id>]`
- Claude Code is running with MCP connection active

## Available MCP Tools

### Patch Management

#### list_registered_patches()

Lists all currently registered patches.

**Usage**:
```python
list_registered_patches()
```

**Returns**:
```python
["test1", "synth", "fx"]  # List of patch_id strings
```

**Example**:
```python
# Check which patches are available
patches = list_registered_patches()
print(f"Available patches: {patches}")
```

### Object Operations

#### add_max_object()

Adds a new Max object to a specific patch.

**Parameters**:
- `patch_id` (str): Target patch identifier
- `position` (list): [x, y] coordinates
- `obj_type` (str): Max object type (e.g., "cycle~", "button")
- `varname` (str): Unique variable name for script access
- `args` (list, optional): Object arguments

**Usage**:
```python
add_max_object(
    patch_id="synth",
    position=[200, 300],
    obj_type="cycle~",
    varname="osc1",
    args=[440]
)
```

**Common Object Types**:
- Audio: `"cycle~"`, `"saw~"`, `"noise~"`, `"filter~"`
- UI: `"button"`, `"toggle"`, `"slider"`, `"number"`
- Control: `"metro"`, `"counter"`, `"gate"`
- Math: `"+"``, `"-"`, `"*"`, `"/"`
- Audio IO: `"ezdac~"`, `"ezadc~"`, `"adc~"`, `"dac~"`

**Example - Simple Oscillator**:
```python
# Add 440Hz oscillator
add_max_object(
    patch_id="synth",
    position=[100, 100],
    obj_type="cycle~",
    varname="main_osc",
    args=[440]
)

# Add gain control
add_max_object(
    patch_id="synth",
    position=[100, 200],
    obj_type="gain~",
    varname="main_gain",
    args=[]
)

# Add audio output
add_max_object(
    patch_id="synth",
    position=[100, 300],
    obj_type="ezdac~",
    varname="audio_out",
    args=[]
)
```

#### remove_max_object()

Removes an object from a patch.

**Parameters**:
- `patch_id` (str): Target patch identifier
- `varname` (str): Variable name of object to remove

**Usage**:
```python
remove_max_object(
    patch_id="synth",
    varname="main_osc"
)
```

**Example**:
```python
# Clean up old objects
old_objects = ["temp_osc", "test_filter", "debug_print"]
for obj in old_objects:
    remove_max_object(patch_id="synth", varname=obj)
```

### Connection Operations

#### connect_max_objects()

Creates a patchcord between two objects.

**Parameters**:
- `patch_id` (str): Target patch identifier
- `src_varname` (str): Source object varname
- `outlet_idx` (int): Source outlet index (0-based)
- `dst_varname` (str): Destination object varname
- `inlet_idx` (int): Destination inlet index (0-based)

**Usage**:
```python
connect_max_objects(
    patch_id="synth",
    src_varname="main_osc",
    outlet_idx=0,
    dst_varname="main_gain",
    inlet_idx=0
)
```

**Outlet/Inlet Indexing**:
- **0-based**: First outlet/inlet is index 0
- **Multiple outlets**: Check Max object help for outlet order
- **Signal vs. Control**: ~ objects typically have signal outlets first

**Example - Complete Signal Chain**:
```python
# cycle~ → gain~ → ezdac~ (left and right)

# Connect oscillator to gain
connect_max_objects(
    patch_id="synth",
    src_varname="main_osc",
    outlet_idx=0,
    dst_varname="main_gain",
    inlet_idx=0
)

# Connect gain to left channel
connect_max_objects(
    patch_id="synth",
    src_varname="main_gain",
    outlet_idx=0,
    dst_varname="audio_out",
    inlet_idx=0
)

# Connect gain to right channel
connect_max_objects(
    patch_id="synth",
    src_varname="main_gain",
    outlet_idx=0,
    dst_varname="audio_out",
    inlet_idx=1
)
```

#### disconnect_max_objects()

Removes a patchcord between two objects.

**Parameters**: Same as `connect_max_objects()`

**Usage**:
```python
disconnect_max_objects(
    patch_id="synth",
    src_varname="main_gain",
    outlet_idx=0,
    dst_varname="audio_out",
    inlet_idx=1
)
```

### Patch Inspection

#### get_objects_in_patch()

Returns all objects and patchcords in a patch.

**Parameters**:
- `patch_id` (str): Target patch identifier

**Returns**:
```python
{
    "objects": [
        {
            "varname": "main_osc",
            "type": "newobj",
            "text": "cycle~ 440",
            "position": [100, 100, 150, 120],
            ...
        },
        ...
    ],
    "patchcords": [
        {
            "src": "main_osc",
            "src_outlet": 0,
            "dst": "main_gain",
            "dst_inlet": 0
        },
        ...
    ]
}
```

**Usage**:
```python
# Inspect patch contents
patch_data = get_objects_in_patch(patch_id="synth")

# Count objects
print(f"Objects: {len(patch_data['objects'])}")
print(f"Connections: {len(patch_data['patchcords'])}")

# List all varnames
for obj in patch_data['objects']:
    print(f"- {obj['varname']}: {obj['text']}")
```

#### get_avoid_rect_position()

Gets the bounding box of existing objects (useful for placing new objects).

**Parameters**:
- `patch_id` (str): Target patch identifier

**Returns**:
```python
[left, top, right, bottom]  # e.g., [0, 0, 800, 600]
```

**Usage**:
```python
# Get safe placement area
avoid_rect = get_avoid_rect_position(patch_id="synth")
[left, top, right, bottom] = avoid_rect

# Place new object outside existing area
new_x = right + 50
new_y = top

add_max_object(
    patch_id="synth",
    position=[new_x, new_y],
    obj_type="filter~",
    varname="new_filter",
    args=["lowpass", 1000]
)
```

### Documentation Tools

#### list_all_objects()

Lists all available Max/MSP objects with brief descriptions.

**Usage**:
```python
all_objects = list_all_objects()

# Search for filter objects
filters = [obj for obj in all_objects if 'filter' in obj.lower()]
print(filters)
```

**Returns**: List of object names from `docs.json`

#### get_object_doc()

Gets detailed documentation for a specific Max object.

**Parameters**:
- `object_name` (str): Max object name

**Returns**: Documentation dict with description, arguments, inlets, outlets, etc.

**Usage**:
```python
# Get documentation for cycle~
doc = get_object_doc("cycle~")
print(doc['description'])
print(doc['arguments'])
```

## Common Workflows

### Workflow 1: Simple Synthesizer

Create a basic synthesizer with frequency and amplitude control.

```python
# 1. Check patch is registered
patches = list_registered_patches()
if "synth" not in patches:
    print("Error: synth patch not registered")
    exit()

# 2. Get safe placement area
avoid_rect = get_avoid_rect_position("synth")
start_x = avoid_rect[2] + 50
start_y = 100

# 3. Add oscillator
add_max_object(
    patch_id="synth",
    position=[start_x, start_y],
    obj_type="cycle~",
    varname="osc",
    args=[440]
)

# 4. Add frequency control
add_max_object(
    patch_id="synth",
    position=[start_x, start_y - 50],
    obj_type="number",
    varname="freq_ctrl",
    args=[]
)

# 5. Add gain
add_max_object(
    patch_id="synth",
    position=[start_x, start_y + 100],
    obj_type="gain~",
    varname="amp",
    args=[]
)

# 6. Add output
add_max_object(
    patch_id="synth",
    position=[start_x, start_y + 200],
    obj_type="ezdac~",
    varname="out",
    args=[]
)

# 7. Connect everything
connect_max_objects("synth", "freq_ctrl", 0, "osc", 0)
connect_max_objects("synth", "osc", 0, "amp", 0)
connect_max_objects("synth", "amp", 0, "out", 0)
connect_max_objects("synth", "amp", 0, "out", 1)

print("✓ Synthesizer created!")
```

### Workflow 2: Multi-Patch Orchestra

Control multiple patches simultaneously.

```python
# Define patches
patches = {
    "bass": {"freq": 110, "pos": [100, 100]},
    "melody": {"freq": 440, "pos": [100, 100]},
    "pad": {"freq": 220, "pos": [100, 100]}
}

# Create oscillator in each patch
for patch_id, config in patches.items():
    add_max_object(
        patch_id=patch_id,
        position=config["pos"],
        obj_type="cycle~",
        varname="osc",
        args=[config["freq"]]
    )

    add_max_object(
        patch_id=patch_id,
        position=[config["pos"][0], config["pos"][1] + 100],
        obj_type="gain~",
        varname="gain",
        args=[]
    )

    add_max_object(
        patch_id=patch_id,
        position=[config["pos"][0], config["pos"][1] + 200],
        obj_type="ezdac~",
        varname="out",
        args=[]
    )

    # Connect
    connect_max_objects(patch_id, "osc", 0, "gain", 0)
    connect_max_objects(patch_id, "gain", 0, "out", 0)
    connect_max_objects(patch_id, "gain", 0, "out", 1)

print("✓ Orchestra ready!")
```

### Workflow 3: Effect Chain

Build an audio effect chain.

```python
effects = [
    {"type": "filtergraph~", "args": [], "var": "eq"},
    {"type": "freeverb~", "args": [], "var": "reverb"},
    {"type": "tanh~", "args": [], "var": "distortion"},
    {"type": "gain~", "args": [], "var": "output"}
]

x, y = 200, 100
spacing = 100

# Add input
add_max_object("fx", [x, y], "ezadc~", "input", [])
y += spacing

# Add effects
for i, effect in enumerate(effects):
    add_max_object("fx", [x, y], effect["type"], effect["var"], effect["args"])

    # Connect to previous
    if i == 0:
        connect_max_objects("fx", "input", 0, effect["var"], 0)
    else:
        prev = effects[i-1]["var"]
        connect_max_objects("fx", prev, 0, effect["var"], 0)

    y += spacing

# Add output
add_max_object("fx", [x, y], "ezdac~", "output", [])
connect_max_objects("fx", "output", 0, "output", 0)
connect_max_objects("fx", "output", 0, "output", 1)

print("✓ Effect chain created!")
```

## Best Practices

### 1. Always Use Unique varnames

```python
# Good
add_max_object("synth", [100, 100], "cycle~", "osc_bass", [110])
add_max_object("synth", [100, 200], "cycle~", "osc_lead", [440])

# Bad - duplicate varnames
add_max_object("synth", [100, 100], "cycle~", "osc", [110])
add_max_object("synth", [100, 200], "cycle~", "osc", [440])  # Error!
```

### 2. Check Registration Before Operations

```python
# Good
patches = list_registered_patches()
if "synth" in patches:
    add_max_object("synth", ...)
else:
    print("Patch not registered")

# Bad - no check
add_max_object("synth", ...)  # May timeout if not registered
```

### 3. Use get_avoid_rect_position() for Placement

```python
# Good - dynamic placement
avoid_rect = get_avoid_rect_position("synth")
new_x = avoid_rect[2] + 50
add_max_object("synth", [new_x, 100], ...)

# Bad - hardcoded positions may overlap
add_max_object("synth", [100, 100], ...)
```

### 4. Verify After Operations

```python
# Good - verify
add_max_object("synth", [100, 100], "cycle~", "osc1", [440])
patch_data = get_objects_in_patch("synth")
varnames = [obj["varname"] for obj in patch_data["objects"]]
assert "osc1" in varnames, "Object not created!"

# Bad - no verification
add_max_object("synth", [100, 100], "cycle~", "osc1", [440])
# Did it work? Unknown.
```

### 5. Clean Up on Errors

```python
# Good - error handling
try:
    add_max_object("synth", [100, 100], "cycle~", "osc", [440])
    connect_max_objects("synth", "osc", 0, "gain", 0)
except Exception as e:
    print(f"Error: {e}")
    # Clean up partial changes
    remove_max_object("synth", "osc")

# Bad - no cleanup
add_max_object("synth", [100, 100], "cycle~", "osc", [440])
connect_max_objects("synth", "osc", 0, "gain", 0)  # Fails, osc remains
```

## Advanced Topics

### Coordinate System

Max/MSP uses a coordinate system where:
- Origin (0, 0) is top-left
- X increases to the right
- Y increases downward
- Position format: `[x, y, width, height]`

**Grid Alignment**:
```python
# Snap to grid (20px)
def snap_to_grid(pos, grid=20):
    return [(coord // grid) * grid for coord in pos]

x, y = snap_to_grid([123, 456])  # → [120, 460]
```

### Object Arguments

Different objects accept different arguments:

```python
# Oscillators
add_max_object(patch_id, pos, "cycle~", var, [frequency])
add_max_object(patch_id, pos, "saw~", var, [frequency])

# Filters
add_max_object(patch_id, pos, "filtercoeff~", var, ["lowpass", freq, Q])

# Math
add_max_object(patch_id, pos, "+", var, [value])
add_max_object(patch_id, pos, "*", var, [multiplier])

# Timing
add_max_object(patch_id, pos, "metro", var, [interval_ms])
```

### Error Messages

Common errors and their meanings:

- **Timeout (2s)**: Max not responding, patch not registered, or JavaScript error
- **Patch not registered**: patch_id not found, check `list_registered_patches()`
- **varname conflict**: Object with same varname already exists
- **Invalid position**: Coordinates out of bounds or invalid format

## Related Documents

- [Setup Guide](SETUP.md) - Installation and configuration
- [Architecture](ARCHITECTURE.md) - System design
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [E2E Test Guide](E2E_TEST_GUIDE.md) - Testing procedures

---

**Happy Patching!** 🎵
