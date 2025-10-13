# MaxMSP-MCP Documentation Index

## Project Overview

MaxMSP-MCP Server is a Model Context Protocol (MCP) implementation that enables LLMs to directly understand and generate Max/MSP patches. The system consists of a Python-based MCP server and Max/MSP-side JavaScript agents communicating via Socket.IO.

**Current Version**: Multi-Patch Support (patch_id-based routing)

## Quick Links

- **[Architecture](ARCHITECTURE.md)** - System architecture and communication flow
- **[Setup Guide](SETUP.md)** - Installation and configuration
- **[Usage Guide](USAGE.md)** - How to use the system
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Specification](SPECIFICATION.md)** - Detailed technical specification
- **[E2E Test Guide](E2E_TEST_GUIDE.md)** - End-to-end testing procedures

## Japanese Documentation

- **[アーキテクチャ](ARCHITECTURE_ja.md)** - システムアーキテクチャと通信フロー
- **[セットアップガイド](SETUP_ja.md)** - インストールと設定
- **[使用方法](USAGE_ja.md)** - システムの使い方
- **[トラブルシューティング](TROUBLESHOOTING_ja.md)** - よくある問題と解決策
- **[仕様書](SPECIFICATION_ja.md)** - 詳細技術仕様
- **[E2Eテストガイド](E2E_TEST_GUIDE_ja.md)** - E2Eテスト手順

## Current Status

### Completed ✅
- Multi-patch architecture with patch_id routing
- Socket.IO communication layer (port 5002)
- Dynamic patch registration system
- Send/receive-based message routing
- Python MCP server with all tools supporting patch_id
- Max Package implementation
- Comprehensive documentation (EN/JA)

### In Progress 🔄
- E2E testing with state verification
- Package distribution preparation

### Planned 📋
- Error handling improvements
- Performance optimization
- Subpatch/bpatcher support investigation
- Community feedback integration

## Repository Structure

```
MaxMSP-MCP-Server-multipatch/
├── server.py                  # Python MCP server (multi-patch version)
├── requirements.txt           # Python dependencies
├── docs.json                  # Max/MSP object documentation (6MB)
├── MaxMSP_Agent/             # Max/MSP side implementation
│   ├── demo.maxpat           # Central hub patch
│   ├── max_mcp_node.js       # Node.js Socket.IO server
│   ├── max_mcp.js            # Socket.IO ↔ Max bridge
│   ├── mcp-router.js         # Central router (patch_id routing)
│   ├── mcp_client.js         # Client in each patch
│   └── test1.maxpat          # Test patch example
├── docs/                     # Documentation
│   ├── INDEX.md              # This file
│   ├── ARCHITECTURE.md       # Architecture details
│   ├── SETUP.md              # Setup guide
│   ├── USAGE.md              # Usage guide
│   ├── TROUBLESHOOTING.md    # Troubleshooting
│   ├── SPECIFICATION.md      # Technical specification
│   ├── E2E_TEST_GUIDE.md     # Testing guide
│   └── *_ja.md               # Japanese versions
└── .venv/                    # Python virtual environment
```

## Getting Started

1. **Read**: [Setup Guide](SETUP.md) or [セットアップガイド](SETUP_ja.md)
2. **Understand**: [Architecture](ARCHITECTURE.md) or [アーキテクチャ](ARCHITECTURE_ja.md)
3. **Use**: [Usage Guide](USAGE.md) or [使用方法](USAGE_ja.md)
4. **Test**: [E2E Test Guide](E2E_TEST_GUIDE.md) or [E2Eテストガイド](E2E_TEST_GUIDE_ja.md)

## Key Concepts

### patch_id System
Each Max/MSP patch is identified by a unique string `patch_id` (e.g., "synth", "fx", "test1"). Users place `[js mcp-client.js <patch_id>]` in their patches, and Claude Code can target specific patches using the `patch_id` parameter.

### Communication Flow
```
Claude Code → Python MCP Server → Socket.IO → Max Router → Patch Client → this.patcher
```

### Registration
Patches automatically register with the system on loadbang, making them available for remote control via MCP.

## Support

- **Issues**: Check [Troubleshooting](TROUBLESHOOTING.md) or [トラブルシューティング](TROUBLESHOOTING_ja.md)
- **Questions**: Refer to [Usage Guide](USAGE.md) or [使用方法](USAGE_ja.md)
- **Technical Details**: See [Specification](SPECIFICATION.md) or [仕様書](SPECIFICATION_ja.md)

## License & Attribution

Original work by tiianhk. Multi-patch extensions developed with Claude Code.

See LICENSE file for details.

---

**Last Updated**: 2025-10-13
