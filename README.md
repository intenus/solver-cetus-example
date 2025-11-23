# Intenus Simple Swap Solver

Một solver đơn giản cho Intenus protocol trên Sui testnet, dùng để xử lý swap intents.

## Tính năng

- ✅ Lắng nghe `IntentSubmitted` events qua GraphQL polling
- ✅ Lấy intent data từ Walrus storage
- ✅ Tìm route tối ưu cho swap (demo với Cetus)
- ✅ Submit solution về Intenus protocol
- ✅ Express API server để monitor
- ✅ TypeScript với type safety đầy đủ

## Kiến trúc

```
┌─────────────┐
│ Sui Network │
│  (testnet)  │
└──────┬──────┘
       │ GraphQL polling
       │ (IntentSubmitted events)
       ↓
┌──────────────────┐
│  EventListener   │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐      ┌──────────────┐
│   SimpleSolver   │─────→│    Walrus    │
└────────┬─────────┘      │   Storage    │
         │                └──────────────┘
         │ Submit solution
         ↓
┌─────────────────┐
│ Intenus Protocol│
└─────────────────┘
```

## Yêu cầu

- Node.js v18 hoặc cao hơn
- pnpm (hoặc npm/yarn)
- Sui wallet với testnet SUI tokens
- Private key và public key của solver

## Cài đặt

1. Clone repository:
```bash
git clone <your-repo-url>
cd solver-cetus-example
```

2. Cài đặt dependencies:
```bash
pnpm install
# hoặc
npm install
```

3. Tạo file `.env` từ template:
```bash
cp .env.example .env
```

4. Cấu hình `.env` với thông tin của bạn:
```env
# Wallet configuration - QUAN TRỌNG!
SOLVER_PRIVATE_KEY=your_private_key_here
SOLVER_PUBLIC_KEY=your_public_key_here

# Các config khác có thể giữ nguyên default
```

## Chạy Solver

### Development mode
```bash
pnpm dev
# hoặc
npm run dev
```

### Production mode
```bash
# Build
pnpm build

# Run
pnpm start
```

## API Endpoints

Solver cung cấp các HTTP endpoints để monitor:

### Health Check
```bash
GET http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-23T...",
  "solver": "SimpleSwapSolver"
}
```

### Solver Status
```bash
GET http://localhost:3000/status
```

Response:
```json
{
  "listener": {
    "isRunning": true,
    "lastProcessedCursor": "..."
  },
  "solver": {
    "processedIntents": 5,
    "solverName": "SimpleSwapSolver",
    "minProfit": 0.001
  },
  "config": {
    "network": "testnet",
    "packageId": "0x993c...",
    "pollInterval": 5000
  }
}
```

### Statistics
```bash
GET http://localhost:3000/stats
```

## Cách hoạt động

### 1. Event Listener
Solver sử dụng GraphQL để poll events từ Sui network:
- Query `IntentSubmitted` events từ Intenus package
- Poll mỗi 5 giây (có thể config trong `.env`)
- Lưu cursor để tránh xử lý trùng

### 2. Intent Processing
Khi nhận được intent mới:
1. Fetch intent data từ Walrus storage (via blob ID)
2. Parse swap parameters (tokenIn, tokenOut, amount, slippage, etc.)
3. Tìm route tối ưu

### 3. Route Finding
Solver tìm route tốt nhất:
- Check các DEX pools (Cetus trong demo này)
- Tính toán expected output
- So sánh với minimum output requirement
- Tính profit và gas costs

### 4. Solution Submission
Nếu tìm được route profitable:
1. Store solution data lên Walrus
2. Submit solution transaction lên Intenus protocol
3. Đợi user select và execute

## Cấu trúc Code

```
src/
├── index.ts              # Entry point
├── server.ts             # Express server
├── config.ts             # Configuration loader
├── services/
│   ├── eventListener.ts  # GraphQL event polling
│   └── solver.ts         # Solver logic
├── types/
│   └── intent.ts         # TypeScript types
└── utils/
    └── walrus.ts         # Walrus storage helpers
```

## Customization

### Thay đổi poll interval
Trong `.env`:
```env
EVENT_POLL_INTERVAL=3000  # 3 seconds
```

### Thay đổi minimum profit
Trong `.env`:
```env
SOLVER_MIN_PROFIT=0.005  # 0.5%
```

### Thêm logic routing
Edit `src/services/solver.ts` → `findBestRoute()` method:
```typescript
private async findBestRoute(intent: SwapIntent): Promise<Solution | null> {
  // Thêm logic của bạn ở đây
  // - Query nhiều DEX
  // - Tính optimal route
  // - Consider gas costs
}
```

## Development Notes

### Placeholders
Code này là demo version với một số placeholders:

1. **Walrus Integration**: `src/utils/walrus.ts`
   - Cần implement với `@intenus/walrus` SDK
   - Hiện tại return mock data

2. **Solution Submission**: `src/services/solver.ts`
   - Cần implement với `@intenus/solver-sdk`
   - Hiện tại chỉ log ra console

3. **Route Finding**: `src/services/solver.ts`
   - Cần integrate với Cetus SDK thực
   - Hiện tại dùng hardcoded route

### Next Steps để Production-Ready

1. **Integrate Walrus SDK**:
```typescript
import { IntenusWalrusClient } from '@intenus/walrus';
const walrusClient = new IntenusWalrusClient({...});
```

2. **Integrate Solver SDK**:
```typescript
import { SolutionBuilder } from '@intenus/solver-sdk';
const solution = new SolutionBuilder()
  .intentId(intentId)
  .solutionBlob(blobId)
  .submit();
```

3. **Integrate Cetus SDK**:
```typescript
import { CetusClmmSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';
const sdk = new CetusClmmSDK({...});
const pools = await sdk.Pool.getPools();
```

4. **Add Error Handling**:
   - Retry logic cho network failures
   - Dead letter queue cho failed intents
   - Alerting cho critical errors

5. **Add Monitoring**:
   - Prometheus metrics
   - Logging với structured logs
   - Performance tracking

6. **Security**:
   - Secure key management (không commit .env)
   - Rate limiting
   - Input validation

## Troubleshooting

### Solver không nhận được events
- Check GraphQL endpoint có hoạt động không: `https://graphql.testnet.sui.io/graphql`
- Verify package ID đúng
- Check logs xem có error gì không

### Không thể submit solution
- Verify private key đúng format
- Check wallet có đủ SUI tokens không
- Check solver đã register với protocol chưa

### Build errors
```bash
# Clean và rebuild
pnpm clean
pnpm build
```

## License

MIT

## Resources

- [Intenus SDK](https://github.com/intenus/sdks)
- [Intenus Contracts](https://github.com/intenus/contracts)
- [Sui GraphQL Docs](https://docs.sui.io/guides/developer/advanced/graphql-rpc)
- [Cetus Developer Docs](https://cetus-1.gitbook.io/cetus-developer-docs)
