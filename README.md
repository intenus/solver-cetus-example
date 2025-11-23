# Intenus Cetus Solver Example

Một solver đơn giản cho Intenus protocol sử dụng Cetus Protocol để xử lý swap intents trên Sui blockchain.

## Tính năng

- 🔍 **Event Listening**: Lắng nghe IntentSubmitted events từ Intenus protocol
- 🌊 **Cetus Integration**: Tích hợp Cetus CLMM SDK để tìm best swap routes
- 💰 **Profitability Check**: Kiểm tra lợi nhuận và price impact trước khi submit
- 📦 **Walrus Storage**: Sử dụng Walrus để store/fetch intent và solution data
- 🚀 **Auto Submission**: Tự động submit solutions sử dụng Intenus SDK

## Kiến trúc

```
src/
├── config.ts              # Configuration và environment variables
├── index.ts               # Entry point
├── server.ts              # Express server với monitoring endpoints
├── services/
│   ├── eventListener.ts   # GraphQL polling cho IntentSubmitted events
│   ├── solver.ts          # Main solver logic
│   ├── cetusService.ts    # Cetus Protocol integration
│   └── solutionService.ts # Solution submission với Intenus SDK
├── types/
│   └── intent.ts          # Type definitions
└── utils/
    └── walrus.ts          # Walrus storage utilities
```

## Cài đặt

1. **Clone và install dependencies:**
   ```bash
   npm install
   ```

2. **Cấu hình environment variables:**
   Tạo file `.env` từ `.env.example`:
   ```bash
   # Sui Network Configuration
   SUI_NETWORK=testnet
   SUI_GRAPHQL_URL=https://graphql.testnet.sui.io/graphql
   SUI_RPC_URL=https://fullnode.testnet.sui.io:443

   # Solver Configuration
   SOLVER_PRIVATE_KEY=your_private_key_here
   SOLVER_PUBLIC_KEY=your_public_key_here
   SOLVER_NAME=CetusSwapSolver
   SOLVER_MIN_PROFIT=0.001

   # Intenus Protocol Configuration
   INTENUS_PACKAGE_ID=0x993c7635b44582e9c47c589c759239d3e1ce787811af5bfa0056aa253caa394a

   # Server Configuration
   PORT=3000

   # Polling Configuration
   EVENT_POLL_INTERVAL=5000
   ```

3. **Generate keypair (nếu chưa có):**
   ```bash
   # Sử dụng Sui CLI
   sui keytool generate ed25519
   ```

## Chạy Solver

### Development mode:
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## API Endpoints

Solver cung cấp các monitoring endpoints:

- `GET /health` - Health check
- `GET /status` - Detailed status (listener, solver, config)
- `GET /stats` - Solver statistics
- `POST /test/process-intent` - Manual intent processing (for testing)

## Cách hoạt động

1. **Event Listening**: Solver liên tục poll GraphQL endpoint để tìm IntentSubmitted events mới
2. **Intent Processing**: Khi có intent mới:
   - Fetch intent data từ Walrus storage
   - Parse swap parameters (tokenIn, tokenOut, amountIn, minAmountOut)
3. **Route Finding**: Sử dụng Cetus SDK để:
   - Tìm pools phù hợp
   - Calculate best swap route
   - Kiểm tra slippage và price impact
4. **Profitability Check**: Đảm bảo profit >= minimum threshold
5. **Solution Submission**: 
   - Store solution data to Walrus
   - Submit solution transaction sử dụng Intenus SDK

## Cetus Integration

Solver sử dụng `@cetusprotocol/sui-clmm-sdk` để:

- **Pool Discovery**: Tìm pools hỗ trợ token pair
- **Price Calculation**: Sử dụng `preSwap` để calculate expected output
- **Slippage Protection**: Apply slippage tolerance
- **Price Impact**: Calculate và kiểm tra price impact

### Supported Features:
- ✅ Direct swaps (A → B)
- ✅ Slippage protection
- ✅ Price impact calculation
- ✅ Pool liquidity checking
- 🚧 Multi-hop routes (future)
- 🚧 Multiple DEX aggregation (future)

## Constraints và Validation

Solver áp dụng các constraints sau:

- **Minimum Profit**: Configurable minimum profit percentage
- **Price Impact**: Maximum 5% price impact
- **Slippage**: Respects intent slippage tolerance
- **Deadline**: Kiểm tra intent deadline
- **Liquidity**: Đảm bảo pool có đủ liquidity

## Monitoring

### Logs
Solver cung cấp detailed logging cho:
- Intent processing
- Route finding
- Solution submission
- Error handling

### Metrics
- Processed intents count
- Success/failure rates
- Pool cache statistics
- Solver balance

## Development

### Testing
```bash
# Test manual intent processing
curl -X POST http://localhost:3000/test/process-intent \\
  -H "Content-Type: application/json" \\
  -d '{"event": {...}}'
```

### Debugging
- Set `EVENT_POLL_INTERVAL=1000` cho faster testing
- Check `/status` endpoint cho detailed diagnostics
- Monitor console logs cho real-time processing

## Troubleshooting

### Common Issues:

1. **"No pools found"**: 
   - Kiểm tra token addresses
   - Đảm bảo tokens có pools trên Cetus

2. **"Configuration validation failed"**:
   - Kiểm tra `.env` file
   - Đảm bảo private key format đúng

3. **"Error fetching from Walrus"**:
   - Solver sẽ fallback to mock data cho demo
   - Kiểm tra Walrus client configuration

4. **"Transaction failed"**:
   - Kiểm tra solver balance
   - Verify Intenus package ID
   - Check network connectivity

## Architecture Notes

### Event Listening Strategy
- Sử dụng GraphQL polling (subscriptions chưa support trên Sui)
- Cursor-based pagination để avoid duplicate processing
- Configurable poll interval

### Caching Strategy
- Pool data cached 1 minute
- Token metadata cached
- Intent processing deduplication

### Error Handling
- Graceful degradation với mock data
- Retry logic cho network calls
- Comprehensive error logging

## Future Enhancements

- [ ] Multi-hop routing
- [ ] Multiple DEX aggregation (Turbos, Aftermath)
- [ ] Advanced MEV protection
- [ ] Dynamic gas estimation
- [ ] Performance metrics dashboard
- [ ] WebSocket event streaming
- [ ] Intent batching optimization

## Contributing

1. Fork repository
2. Create feature branch
3. Implement changes với proper testing
4. Submit pull request

## License

MIT License - see LICENSE file for details.