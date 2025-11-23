# Setup Guide

## Cài đặt Dependencies

```bash
pnpm install
```

## Cấu hình Environment Variables

Tạo file `.env` với nội dung sau:

```env
# Sui Network Configuration
SUI_NETWORK=testnet
SUI_GRAPHQL_URL=https://graphql.testnet.sui.io/graphql
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Solver Configuration
# Generate keypair with: sui keytool generate ed25519
SOLVER_PRIVATE_KEY=your_private_key_here
SOLVER_PUBLIC_KEY=your_public_key_here

# Intenus Protocol Configuration
INTENUS_PACKAGE_ID=0x993c7635b44582e9c47c589c759239d3e1ce787811af5bfa0056aa253caa394a

# Server Configuration
PORT=3000

# Polling Configuration (milliseconds)
EVENT_POLL_INTERVAL=5000
```

## Generate Keypair

Sử dụng Sui CLI để tạo keypair:

```bash
sui keytool generate ed25519
```

Copy private key và public key vào file `.env`.

## Chạy Solver

### Development mode:
```bash
pnpm dev
```

### Production mode:
```bash
pnpm build
pnpm start
```

## Test Endpoints

- Health check: `curl http://localhost:3000/health`
- Status: `curl http://localhost:3000/status`
- Stats: `curl http://localhost:3000/stats`

## Troubleshooting

1. **"SOLVER_PRIVATE_KEY is required"**: Đảm bảo đã set private key trong `.env`
2. **"invalid string length"**: Private key format không đúng, sử dụng `sui keytool generate ed25519`
3. **Port already in use**: Thay đổi PORT trong `.env` hoặc kill process đang dùng port 3000
