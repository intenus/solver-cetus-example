# Quick Start Guide

## Bước 1: Setup môi trường

```bash
# Copy env example
cp .env.example .env

# Edit .env và điền private key + public key của bạn
nano .env  # hoặc dùng editor bất kỳ
```

Trong file `.env`, update các dòng sau:
```env
SOLVER_PRIVATE_KEY=suiprivkey1...  # Private key của wallet solver
SOLVER_PUBLIC_KEY=0x...            # Public address của wallet solver
```

## Bước 2: Cài đặt dependencies

```bash
npm install
# hoặc
pnpm install
```

## Bước 3: Chạy solver

### Development mode (với hot reload)
```bash
npm run dev
```

### Production mode
```bash
npm run build
npm start
```

### Chạy với Docker
```bash
# Build image
docker build -t intenus-solver .

# Run container
docker-compose up -d

# Xem logs
docker-compose logs -f solver
```

## Bước 4: Kiểm tra solver hoạt động

Mở browser hoặc dùng curl:

```bash
# Health check
curl http://localhost:3000/health

# Kiểm tra status
curl http://localhost:3000/status

# Xem stats
curl http://localhost:3000/stats
```

## Output mong đợi

Khi solver chạy, bạn sẽ thấy:

```
============================================================
🚀 SimpleSwapSolver started!
============================================================
📡 Server running on port 3000
🌐 Network: testnet
📦 Package ID: 0x993c7635b44582e9c47c589c759239d3e1ce787811af5bfa0056aa253caa394a
⏱️  Poll interval: 5000ms
============================================================

Starting event listener (polling every 5000ms)...
```

Khi có intent mới:

```
============================================================
Processing new intent: 0x1234...
Submitter: 0x5678...
Blob ID: abc123...
Fee: 1000000 MIST
============================================================

Intent details:
  Token In: SUI
  Token Out: USDC
  Amount In: 1000000000
  Min Amount Out: 1500000
  Slippage: 1%

🔍 Finding best swap route...
📊 Route analysis:
  Protocol: Cetus
  Expected output: 1530000
  Profit: 0.0200%
✅ Profitable route found!

📤 Submitting solution...
  Solution blob ID: blob_1234...
  📝 Solution submitted (placeholder - implement SDK call)
  Solution ID: solution_1234...
✅ Successfully processed intent 0x1234...
```

## Monitoring

### Via HTTP endpoints
```bash
# Real-time stats
watch -n 2 'curl -s http://localhost:3000/stats | jq'
```

### Via Docker logs
```bash
docker-compose logs -f solver
```

## Troubleshooting

### "Configuration errors: SOLVER_PRIVATE_KEY is required"
→ Bạn chưa set private key trong `.env`

### "Error fetching events from GraphQL"
→ Check kết nối internet và GraphQL endpoint

### "No profitable route found"
→ Đây là bình thường, solver chỉ submit solution khi có profit

## Next Steps

1. **Test với real intent**: Submit một intent lên testnet và xem solver process
2. **Customize routing logic**: Edit `src/services/solver.ts`
3. **Integrate Cetus SDK**: Thêm real pool queries
4. **Add monitoring**: Prometheus, Grafana, etc.

## Câu hỏi thường gặp

**Q: Solver có tự động chạy 24/7 không?**
A: Có, một khi start, solver sẽ continuously poll cho events mới.

**Q: Tôi có cần register solver với protocol không?**
A: Để submit solution thực, có. Nhưng code này demo nên chưa implement registration.

**Q: Làm sao test mà không cần real intents?**
A: Dùng POST endpoint để test manually:
```bash
curl -X POST http://localhost:3000/test/process-intent \
  -H "Content-Type: application/json" \
  -d '{"event": {...}}'
```

**Q: Code này production-ready chưa?**
A: Chưa! Đây là demo/example. Cần thêm:
- Real Walrus integration
- Real SDK integration
- Error handling
- Monitoring
- Security hardening
