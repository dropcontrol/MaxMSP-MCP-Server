import os
import json
import argparse
from pathlib import Path

CONFIG_PATHS = {
    "claude-code": "~/.claude.json",
    "claude-desktop": (
        "~/Library/Application Support/Claude/claude_desktop_config.json"
        if os.name == "posix"  # macOS or Linux
        else r"%APPDATA%\Claude\claude_desktop_config.json"  # Windows
    ),
    "cursor": "~/.cursor/mcp.json",
}

UNTESTED_CLIENTS = ["claude-desktop", "cursor"]


def expand_path(path):
    # Expand ~
    path = os.path.expanduser(path)
    # Expand environment variables like %APPDATA%
    path = os.path.expandvars(path)
    # Normalize and convert to absolute path
    return os.path.abspath(path)


def load_json(file_path: Path):
    # Not exist or is empty
    if not file_path.exists() or file_path.stat().st_size == 0:
        # Create the file with an empty JSON object
        with open(file_path, "w") as f:
            json.dump({"mcpServers": {}}, f)
    # Load the JSON data
    with open(file_path, "r") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Install MaxMSP-MCP Server (Multi-Patch Edition) to MCP clients"
    )
    parser.add_argument(
        "--client",
        type=str,
        default="claude-code",
        choices=list(CONFIG_PATHS.keys()),
        help=f"Target MCP client. Supported: {', '.join(CONFIG_PATHS.keys())} (default: claude-code)",
    )
    args = parser.parse_args()

    # Warn about untested clients
    if args.client in UNTESTED_CLIENTS:
        print(f"⚠️  WARNING: Installation for '{args.client}' has not been tested.")
        print(f"    This multi-patch edition is primarily tested with 'claude-code'.")
        response = input("    Continue anyway? (y/N): ")
        if response.lower() != "y":
            print("Installation cancelled.")
            return

    config_path = Path(expand_path(CONFIG_PATHS[args.client]))
    config_data = load_json(config_path)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isdir(os.path.join(current_dir, ".venv")):
        raise FileNotFoundError(
            "Virtual environment not found. Please create one first:\n"
            "  uv venv\n"
            "  uv pip install -r requirements.txt"
        )

    # Configuration for Claude Code (CLI)
    if args.client == "claude-code":
        config_data["mcpServers"]["MaxMSPMCP"] = {
            "type": "stdio",
            "command": os.path.join(current_dir, ".venv/bin/python"),
            "args": [os.path.join(current_dir, "server.py")],
        }
    # Configuration for other clients (untested)
    else:
        config_data["mcpServers"]["MaxMSPMCP"] = {
            "command": "mcp",
            "args": ["run", os.path.join(current_dir, "server.py")],
            "env": {
                "PATH": os.path.join(current_dir, ".venv/bin"),
                "VIRTUAL_ENV": os.path.join(current_dir, ".venv"),
            },
        }

    with open(config_path, "w") as f:
        json.dump(config_data, f, indent=4)

    print(f"✓ Successfully configured MaxMSPMCP for {args.client}")
    print(f"  Config file: {config_path}")

    if args.client == "claude-code":
        print("\n📝 Next steps:")
        print("  1. Restart Claude Code session if needed")
        print("  2. Verify connection with: claude mcp list")
        print("  3. Start Max/MSP Agent (demo.maxpat → script start)")
        print("  4. Begin using MCP tools in Claude Code!")


if __name__ == "__main__":
    main()
